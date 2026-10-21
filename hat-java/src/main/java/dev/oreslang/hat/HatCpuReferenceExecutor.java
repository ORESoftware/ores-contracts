package dev.oreslang.hat;

import java.util.List;
import java.util.Objects;

/** Deterministic host reference executor for portable HAT v1 scalar kernels. */
public final class HatCpuReferenceExecutor {
    private HatCpuReferenceExecutor() { }

    public static long execute(HatKernelIr.Kernel kernel, long... arguments) {
        Objects.requireNonNull(arguments, "arguments");
        if (kernel.abiVersion() != HatKernelIr.ABI_VERSION) {
            throw new IllegalArgumentException("unsupported HAT kernel IR ABI " + kernel.abiVersion());
        }
        if (arguments.length != kernel.entry().parameters().size()) {
            throw new IllegalArgumentException(
                    "HAT kernel '" + kernel.qualifiedName() + "' expected "
                            + kernel.entry().parameters().size() + " arguments but got "
                            + arguments.length);
        }
        return evaluate(kernel.entry().result(), arguments, 1);
    }

    public static long execute(HatKernelIr.Kernel kernel, List<Long> arguments) {
        Objects.requireNonNull(arguments, "arguments");
        long[] values = new long[arguments.size()];
        for (int i = 0; i < arguments.size(); i++) {
            Long value = arguments.get(i);
            if (value == null) throw new IllegalArgumentException("HAT arguments cannot contain null");
            values[i] = value;
        }
        return execute(kernel, values);
    }

    private static long evaluate(HatKernelIr.Value value, long[] arguments, int depth) {
        if (depth > 64) throw new IllegalArgumentException("HAT IR expression nesting exceeds 64");
        if (value instanceof HatKernelIr.ConstantI64 constant) return constant.value();
        if (value instanceof HatKernelIr.ParameterRef parameter) {
            if (parameter.index() >= arguments.length) {
                throw new IllegalArgumentException("HAT IR references out-of-range parameter index");
            }
            return arguments[parameter.index()];
        }
        if (value instanceof HatKernelIr.Unary unary) {
            long operand = evaluate(unary.operand(), arguments, depth + 1);
            return switch (unary.op()) {
                case NEG_I64 -> Math.negateExact(operand);
            };
        }
        if (value instanceof HatKernelIr.Binary binary) {
            long left = evaluate(binary.left(), arguments, depth + 1);
            long right = evaluate(binary.right(), arguments, depth + 1);
            return switch (binary.op()) {
                case ADD_I64 -> Math.addExact(left, right);
                case SUB_I64 -> Math.subtractExact(left, right);
                case MUL_I64 -> Math.multiplyExact(left, right);
            };
        }
        throw new IllegalArgumentException("unknown HAT IR value " + value);
    }
}
