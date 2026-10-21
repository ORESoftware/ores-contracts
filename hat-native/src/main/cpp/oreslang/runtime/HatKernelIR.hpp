#pragma once

#include "oreslang/frontend/Parser.hpp"

#include <cstdint>
#include <limits>
#include <memory>
#include <stdexcept>
#include <string>
#include <string_view>
#include <unordered_map>
#include <utility>
#include <vector>

namespace oreslang::hat {

inline constexpr int kAbiVersion = 1;

enum class ScalarType { I64 };
enum class ValueKind { ConstantI64, Parameter, NegI64, AddI64, SubI64, MulI64 };

struct Parameter {
    std::string name;
    ScalarType type = ScalarType::I64;
};

struct Value {
    ValueKind kind = ValueKind::ConstantI64;
    std::int64_t constant = 0;
    std::size_t parameter_index = 0;
    std::string parameter_name;
    std::unique_ptr<Value> left;
    std::unique_ptr<Value> right;
};

struct KernelIR {
    int abi_version = kAbiVersion;
    std::string module;
    std::string name;
    bool exported = false;
    std::vector<Parameter> parameters;
    std::unique_ptr<Value> result;

    std::string qualified_name() const { return module + "." + name; }
};

inline std::unique_ptr<Value> lower_value(
        const Expression& expression,
        const std::unordered_map<std::string, std::size_t>& parameters,
        std::size_t depth = 1) {
    if (depth > 64) throw std::runtime_error("HAT v1 kernel expression nesting exceeds 64");
    using EK = Expression::Kind;
    auto value = std::make_unique<Value>();
    switch (expression.kind) {
        case EK::Integer:
            value->kind = ValueKind::ConstantI64;
            value->constant = expression.integer;
            return value;
        case EK::Variable: {
            const auto found = parameters.find(expression.name);
            if (found == parameters.end())
                throw std::runtime_error("HAT v1 kernel may read only its parameters");
            value->kind = ValueKind::Parameter;
            value->parameter_index = found->second;
            value->parameter_name = expression.name;
            return value;
        }
        case EK::Negate:
            if (!expression.left) throw std::runtime_error("malformed HAT unary expression");
            value->kind = ValueKind::NegI64;
            value->left = lower_value(*expression.left, parameters, depth + 1);
            return value;
        case EK::Add:
        case EK::Subtract:
        case EK::Multiply:
            if (!expression.left || !expression.right)
                throw std::runtime_error("malformed HAT binary expression");
            value->kind = expression.kind == EK::Add ? ValueKind::AddI64
                        : expression.kind == EK::Subtract ? ValueKind::SubI64
                                                         : ValueKind::MulI64;
            value->left = lower_value(*expression.left, parameters, depth + 1);
            value->right = lower_value(*expression.right, parameters, depth + 1);
            return value;
        default:
            throw std::runtime_error("HAT v1 unsupported kernel expression");
    }
}

inline KernelIR lower_kernel(std::string module, const HatKernelDecl& source) {
    if (source.entry.name != "main" || source.entry.returns_void || !source.entry.result)
        throw std::runtime_error("invalid admitted HAT v1 kernel entry");
    KernelIR ir;
    ir.module = module.empty() ? "__root__" : std::move(module);
    ir.name = source.name;
    ir.exported = source.exported;

    std::unordered_map<std::string, std::size_t> parameter_indices;
    for (const auto& parameter : source.entry.parameters) {
        if (parameter.mode != oreslang::Parameter::Mode::Value
                || !parameter.class_name.empty() || !parameter.generic_type.empty())
            throw std::runtime_error("HAT v1 kernel parameters must be immutable int values");
        const auto index = ir.parameters.size();
        if (!parameter_indices.emplace(parameter.name, index).second)
            throw std::runtime_error("duplicate HAT v1 kernel parameter");
        ir.parameters.push_back({parameter.name, ScalarType::I64});
    }
    ir.result = lower_value(*source.entry.result, parameter_indices);
    return ir;
}

inline std::vector<KernelIR> lower_kernels(const Program& program) {
    std::vector<KernelIR> result;
    result.reserve(program.kernels.size());
    for (const auto& kernel : program.kernels)
        result.push_back(lower_kernel(program.module, kernel));
    return result;
}

inline const char* op_name(ValueKind kind) {
    switch (kind) {
        case ValueKind::ConstantI64: return "i64";
        case ValueKind::Parameter: return "arg";
        case ValueKind::NegI64: return "NEG_I64";
        case ValueKind::AddI64: return "ADD_I64";
        case ValueKind::SubI64: return "SUB_I64";
        case ValueKind::MulI64: return "MUL_I64";
    }
    throw std::runtime_error("unknown HAT value kind");
}

inline void append_value(std::string& out, const Value& value) {
    switch (value.kind) {
        case ValueKind::ConstantI64:
            out += "i64(" + std::to_string(value.constant) + ")";
            return;
        case ValueKind::Parameter:
            out += "arg(" + std::to_string(value.parameter_index) + ":" +
                   value.parameter_name + ":I64)";
            return;
        case ValueKind::NegI64:
            out += "NEG_I64(";
            if (!value.left) throw std::runtime_error("malformed HAT IR unary");
            append_value(out, *value.left);
            out += ")";
            return;
        case ValueKind::AddI64:
        case ValueKind::SubI64:
        case ValueKind::MulI64:
            out += op_name(value.kind);
            out += "(";
            if (!value.left || !value.right) throw std::runtime_error("malformed HAT IR binary");
            append_value(out, *value.left);
            out += ",";
            append_value(out, *value.right);
            out += ")";
            return;
    }
    throw std::runtime_error("unknown HAT IR value");
}

inline std::string canonical(const KernelIR& kernel) {
    if (kernel.abi_version != kAbiVersion)
        throw std::runtime_error("unsupported HAT kernel IR ABI");
    std::string out = "ores-hat-ir-v" + std::to_string(kernel.abi_version) + "\n";
    out += "kernel " + kernel.qualified_name() + " " +
           (kernel.exported ? "PUBLIC" : "PRIVATE") + "\n";
    out += "entry main(";
    for (const auto& parameter : kernel.parameters)
        out += parameter.name + ":I64,";
    out += ")->I64\n";
    if (!kernel.result) throw std::runtime_error("HAT IR kernel has no result");
    append_value(out, *kernel.result);
    out += "\n";
    return out;
}

inline std::int64_t checked_add(std::int64_t left, std::int64_t right) {
    std::int64_t result;
#if defined(__GNUC__) || defined(__clang__)
    if (__builtin_add_overflow(left, right, &result))
        throw std::overflow_error("HAT i64 addition overflow");
    return result;
#else
    if ((right > 0 && left > std::numeric_limits<std::int64_t>::max() - right) ||
        (right < 0 && left < std::numeric_limits<std::int64_t>::min() - right))
        throw std::overflow_error("HAT i64 addition overflow");
    return left + right;
#endif
}

inline std::int64_t checked_sub(std::int64_t left, std::int64_t right) {
    std::int64_t result;
#if defined(__GNUC__) || defined(__clang__)
    if (__builtin_sub_overflow(left, right, &result))
        throw std::overflow_error("HAT i64 subtraction overflow");
    return result;
#else
    if ((right < 0 && left > std::numeric_limits<std::int64_t>::max() + right) ||
        (right > 0 && left < std::numeric_limits<std::int64_t>::min() + right))
        throw std::overflow_error("HAT i64 subtraction overflow");
    return left - right;
#endif
}

inline std::int64_t checked_mul(std::int64_t left, std::int64_t right) {
    std::int64_t result;
#if defined(__GNUC__) || defined(__clang__)
    if (__builtin_mul_overflow(left, right, &result))
        throw std::overflow_error("HAT i64 multiplication overflow");
    return result;
#else
    if (left == 0 || right == 0) return 0;
    const auto max = std::numeric_limits<std::int64_t>::max();
    const auto min = std::numeric_limits<std::int64_t>::min();
    if (left == -1 && right == min) throw std::overflow_error("HAT i64 multiplication overflow");
    if (right == -1 && left == min) throw std::overflow_error("HAT i64 multiplication overflow");
    if (left > 0) {
        if ((right > 0 && left > max / right) ||
            (right < 0 && right < min / left))
            throw std::overflow_error("HAT i64 multiplication overflow");
    } else {
        if ((right > 0 && left < min / right) ||
            (right < 0 && left < max / right))
            throw std::overflow_error("HAT i64 multiplication overflow");
    }
    return left * right;
#endif
}

inline std::int64_t execute_value(
        const Value& value,
        const std::vector<std::int64_t>& arguments,
        std::size_t depth = 1) {
    if (depth > 64) throw std::runtime_error("HAT IR expression nesting exceeds 64");
    switch (value.kind) {
        case ValueKind::ConstantI64: return value.constant;
        case ValueKind::Parameter:
            if (value.parameter_index >= arguments.size())
                throw std::runtime_error("HAT IR parameter index out of range");
            return arguments[value.parameter_index];
        case ValueKind::NegI64: {
            if (!value.left) throw std::runtime_error("malformed HAT IR unary");
            const auto operand = execute_value(*value.left, arguments, depth + 1);
            if (operand == std::numeric_limits<std::int64_t>::min())
                throw std::overflow_error("HAT i64 negation overflow");
            return -operand;
        }
        case ValueKind::AddI64:
        case ValueKind::SubI64:
        case ValueKind::MulI64: {
            if (!value.left || !value.right) throw std::runtime_error("malformed HAT IR binary");
            const auto left = execute_value(*value.left, arguments, depth + 1);
            const auto right = execute_value(*value.right, arguments, depth + 1);
            if (value.kind == ValueKind::AddI64) return checked_add(left, right);
            if (value.kind == ValueKind::SubI64) return checked_sub(left, right);
            return checked_mul(left, right);
        }
    }
    throw std::runtime_error("unknown HAT IR value");
}

inline std::int64_t execute_cpu_reference(
        const KernelIR& kernel,
        const std::vector<std::int64_t>& arguments) {
    if (kernel.abi_version != kAbiVersion)
        throw std::runtime_error("unsupported HAT kernel IR ABI");
    if (arguments.size() != kernel.parameters.size())
        throw std::runtime_error("HAT kernel argument arity mismatch");
    if (!kernel.result) throw std::runtime_error("HAT IR kernel has no result");
    return execute_value(*kernel.result, arguments);
}

} // namespace oreslang::hat
