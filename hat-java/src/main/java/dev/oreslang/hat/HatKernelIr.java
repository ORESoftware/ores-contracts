package dev.oreslang.hat;

import dev.oreslang.ast.Ast;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;

/** Versioned, backend-neutral Oreslang HAT kernel IR. */
public final class HatKernelIr {
    public static final int ABI_VERSION = 1;

    private HatKernelIr() { }

    public enum ScalarType { I64 }
    public enum UnaryOp { NEG_I64 }
    public enum BinaryOp { ADD_I64, SUB_I64, MUL_I64 }

    public record Parameter(String name, ScalarType type) {
        public Parameter {
            if (name == null || name.isBlank()) throw new IllegalArgumentException("HAT parameter name cannot be blank");
            Objects.requireNonNull(type, "HAT parameter type");
        }
    }

    public sealed interface Value permits ConstantI64, ParameterRef, Unary, Binary { }

    public record ConstantI64(long value) implements Value { }

    public record ParameterRef(int index, String name, ScalarType type) implements Value {
        public ParameterRef {
            if (index < 0) throw new IllegalArgumentException("HAT parameter index cannot be negative");
            if (name == null || name.isBlank()) throw new IllegalArgumentException("HAT parameter reference name cannot be blank");
            Objects.requireNonNull(type, "HAT parameter reference type");
        }
    }

    public record Unary(UnaryOp op, Value operand) implements Value {
        public Unary {
            Objects.requireNonNull(op, "HAT unary op");
            Objects.requireNonNull(operand, "HAT unary operand");
        }
    }

    public record Binary(BinaryOp op, Value left, Value right) implements Value {
        public Binary {
            Objects.requireNonNull(op, "HAT binary op");
            Objects.requireNonNull(left, "HAT binary left operand");
            Objects.requireNonNull(right, "HAT binary right operand");
        }
    }

    public record Entry(
            String name,
            List<Parameter> parameters,
            ScalarType returnType,
            Value result) {
        public Entry {
            if (name == null || name.isBlank()) throw new IllegalArgumentException("HAT entry name cannot be blank");
            parameters = List.copyOf(parameters);
            Objects.requireNonNull(returnType, "HAT return type");
            Objects.requireNonNull(result, "HAT result");
        }
    }

    public record Kernel(
            int abiVersion,
            String module,
            String name,
            Ast.Visibility visibility,
            Entry entry) {
        public Kernel {
            if (abiVersion != ABI_VERSION) {
                throw new IllegalArgumentException("unsupported HAT kernel IR ABI " + abiVersion);
            }
            if (module == null || module.isBlank()) throw new IllegalArgumentException("HAT module cannot be blank");
            if (name == null || name.isBlank()) throw new IllegalArgumentException("HAT kernel name cannot be blank");
            Objects.requireNonNull(visibility, "HAT kernel visibility");
            Objects.requireNonNull(entry, "HAT kernel entry");
        }

        public String qualifiedName() {
            return module + "." + name;
        }
    }

    /** Stable provider-facing serialization for cache keys and exact-artifact comparison. */
    public static String canonical(Kernel kernel) {
        Objects.requireNonNull(kernel, "kernel");
        StringBuilder out = new StringBuilder();
        out.append("ores-hat-ir-v").append(kernel.abiVersion()).append('\n');
        out.append("kernel ").append(kernel.module()).append('.').append(kernel.name())
                .append(' ').append(kernel.visibility()).append('\n');
        out.append("entry ").append(kernel.entry().name()).append('(');
        for (Parameter parameter : kernel.entry().parameters()) {
            out.append(parameter.name()).append(':').append(parameter.type()).append(',');
        }
        out.append(")->").append(kernel.entry().returnType()).append('\n');
        appendValue(out, kernel.entry().result());
        out.append('\n');
        return out.toString();
    }

    public static String sha256(Kernel kernel) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(canonical(kernel).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 unavailable", impossible);
        }
    }

    private static void appendValue(StringBuilder out, Value value) {
        if (value instanceof ConstantI64 constant) {
            out.append("i64(").append(constant.value()).append(')');
        } else if (value instanceof ParameterRef parameter) {
            out.append("arg(").append(parameter.index()).append(':')
                    .append(parameter.name()).append(':').append(parameter.type()).append(')');
        } else if (value instanceof Unary unary) {
            out.append(unary.op()).append('(');
            appendValue(out, unary.operand());
            out.append(')');
        } else if (value instanceof Binary binary) {
            out.append(binary.op()).append('(');
            appendValue(out, binary.left());
            out.append(',');
            appendValue(out, binary.right());
            out.append(')');
        } else {
            throw new IllegalArgumentException("unknown HAT IR value " + value);
        }
    }
}
