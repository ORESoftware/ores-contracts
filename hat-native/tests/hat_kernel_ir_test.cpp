#include "oreslang/frontend/Parser.hpp"
#include "oreslang/runtime/HatKernelIR.hpp"

#include <cassert>
#include <cstdint>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>

int main() {
    const auto program = oreslang::parse_program(R"(
define pub kernel Add as
  fnc main(int left, int right): int {
    return left + right;
  }
end
)");
    assert(program.kernels.size() == 1);
    const auto kernels = oreslang::hat::lower_kernels(program);
    assert(kernels.size() == 1);
    const auto& kernel = kernels.front();
    assert(kernel.abi_version == 1);
    assert(kernel.qualified_name() == "__root__.Add");
    assert(kernel.exported);
    assert(kernel.parameters.size() == 2);
    assert(oreslang::hat::execute_cpu_reference(kernel, {19, 23}) == 42);
    assert(oreslang::hat::execute_cpu_reference(kernel, {-10, 3}) == -7);

    const auto text = oreslang::hat::canonical(kernel);
    assert(text.find("ores-hat-ir-v1\n") == 0);
    assert(text.find("ADD_I64(arg(0:left:I64),arg(1:right:I64))") != std::string::npos);

    bool rejected_call = false;
    try {
        (void)oreslang::parse_program(R"(
define kernel Bad as
  fnc main(int value): int {
    return helper(value);
  }
end
)");
    } catch (const std::runtime_error&) {
        rejected_call = true;
    }
    assert(rejected_call);

    bool public_entry_rejected = false;
    try {
        (void)oreslang::parse_program(R"(
define pub kernel BadVisibility as
  pub fnc main(int value): int {
    return value;
  }
end
)");
    } catch (const std::runtime_error&) {
        public_entry_rejected = true;
    }
    assert(public_entry_rejected);

    bool overflow = false;
    try {
        (void)oreslang::hat::execute_cpu_reference(
            kernel, {std::numeric_limits<std::int64_t>::max(), 1});
    } catch (const std::overflow_error&) {
        overflow = true;
    }
    assert(overflow);
    return 0;
}
