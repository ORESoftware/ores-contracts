package dev.oreslang.hat;

import dev.oreslang.ast.Ast;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Lowers the deliberately small HAT v1 source subset into portable kernel IR.
 *
 * v1 is scalar i64 only: exactly one fnc main entry, parameters + literals,
 * unary minus, +, - and *, and exactly one return expression.
 */
public final class HatKernelCompiler {
    private static final int MAX_EXPRESSION_DEPTH = 64;

    private HatKernelCompiler() { }

    public static List<HatKernelIr.Kernel> compile(Ast.Program program) {
        List<HatKernelIr.Kernel> kernels = new ArrayList<>();
        Set<String> qualifiedNames = new HashSet<>();
        for (Ast.ModuleDecl module : program.modules()) {
            for (Ast.Decl declaration : module.declarations()) {
                if (!(declaration instanceof Ast.KernelDecl kernel)) continue;
                String qualified = module.name() + "." + kernel.name();
                if (!qualifiedNames.add(qualified)) {
                    throw new IllegalArgumentException("duplicate HAT kernel '" + qualified + "'");
                }
                kernels.add(lower(module.name(), kernel));
            }
        }
        return List.copyOf(kernels);
    }

    public static void validate(Ast.Program program) {
        compile(program);
    }

    private static HatKernelIr.Kernel lower(String module, Ast.KernelDecl kernel) {
        if (kernel.entries().size() != 1) {
            throw new IllegalArgumentException(
                    "HAT v1 kernel '" + kernel.name() + "' requires exactly one fnc main entry");
        }
        Ast.FunctionDecl entry = kernel.entries().getFirst();
        if (!entry.name().equals("main")) {
            throw new IllegalArgumentException(
                    "HAT v1 kernel '" + kernel.name() + "' entry must be named main");
        }
        if (entry.visibility() != Ast.Visibility.PRIVATE) {
            throw new IllegalArgumentException(
                    "HAT v1 kernel main is internal; visibility belongs on the kernel declaration");
        }
        if (entry.kind() != Ast.CallableKind.FNC
                || entry.actorKind() != Ast.ActorKind.NONE
                || entry.async() || entry.suspends() || entry.generator()
                || entry.structural() || entry.nonLexical() || entry.trapped()) {
            throw new IllegalArgumentException(
                    "HAT v1 kernel entry must be a synchronous non-actor fnc");
        }
        if (!entry.genericParameters().isEmpty()) {
            throw new IllegalArgumentException("HAT v1 kernel entries cannot be generic");
        }
        if (!entry.annotations().isEmpty()) {
            throw new IllegalArgumentException("HAT v1 kernel entries do not admit annotations");
        }
        if (!isI64(entry.returnType())) {
            throw new IllegalArgumentException("HAT v1 kernel main must return int");
        }

        List<HatKernelIr.Parameter> parameters = new ArrayList<>();
        Map<String, Integer> parameterIndices = new HashMap<>();
        for (Ast.Param parameter : entry.parameters()) {
            if (parameter.structural() || parameter.mutable() || !isI64(parameter.type())) {
                throw new IllegalArgumentException(
                        "HAT v1 kernel parameters must be immutable int values");
            }
            int index = parameters.size();
            if (parameterIndices.putIfAbsent(parameter.name(), index) != null) {
                throw new IllegalArgumentException(
                        "duplicate HAT kernel parameter '" + parameter.name() + "'");
            }
            parameters.add(new HatKernelIr.Parameter(parameter.name(), HatKernelIr.ScalarType.I64));
        }

        if (entry.body().size() != 1
                || !(entry.body().getFirst() instanceof Ast.ReturnStmt returned)
                || returned.value() == null) {
            throw new IllegalArgumentException(
                    "HAT v1 kernel main must contain exactly one value-return statement");
        }

        HatKernelIr.Value result = lowerValue(returned.value(), parameterIndices, 1);
        HatKernelIr.Entry loweredEntry = new HatKernelIr.Entry(
                "main", parameters, HatKernelIr.ScalarType.I64, result);
        return new HatKernelIr.Kernel(
                HatKernelIr.ABI_VERSION, module, kernel.name(), kernel.visibility(), loweredEntry);
    }

    private static boolean isI64(Ast.TypeRef type) {
        return type != null && type.name().equals("int")
                && type.arguments().isEmpty() && !type.inferArguments();
    }

    private static HatKernelIr.Value lowerValue(
            Ast.Expr expression,
            Map<String, Integer> parameterIndices,
            int depth) {
        if (depth > MAX_EXPRESSION_DEPTH) {
            throw new IllegalArgumentException("HAT v1 kernel expression nesting exceeds 64");
        }
        if (expression instanceof Ast.LiteralExpr literal && literal.value() instanceof Long value) {
            return new HatKernelIr.ConstantI64(value);
        }
        if (expression instanceof Ast.LiteralExpr) {
            throw new IllegalArgumentException("HAT v1 admits only source int literals");
        }
        if (expression instanceof Ast.NameExpr name) {
            Integer index = parameterIndices.get(name.name());
            if (index == null) {
                throw new IllegalArgumentException(
                        "HAT v1 kernel may read only its parameters; unknown name '" + name.name() + "'");
            }
            return new HatKernelIr.ParameterRef(index, name.name(), HatKernelIr.ScalarType.I64);
        }
        if (expression instanceof Ast.UnaryExpr unary && unary.operator().equals("-")) {
            return new HatKernelIr.Unary(
                    HatKernelIr.UnaryOp.NEG_I64,
                    lowerValue(unary.operand(), parameterIndices, depth + 1));
        }
        if (expression instanceof Ast.BinaryExpr binary) {
            HatKernelIr.BinaryOp op = switch (binary.operator()) {
                case "+" -> HatKernelIr.BinaryOp.ADD_I64;
                case "-" -> HatKernelIr.BinaryOp.SUB_I64;
                case "*" -> HatKernelIr.BinaryOp.MUL_I64;
                default -> throw new IllegalArgumentException(
                        "HAT v1 unsupported binary operator '" + binary.operator() + "'");
            };
            return new HatKernelIr.Binary(
                    op,
                    lowerValue(binary.left(), parameterIndices, depth + 1),
                    lowerValue(binary.right(), parameterIndices, depth + 1));
        }
        throw new IllegalArgumentException(
                "HAT v1 unsupported kernel expression " + expression.getClass().getSimpleName());
    }
}
