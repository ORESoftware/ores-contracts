import dev.oreslang.hat.HatCpuReferenceExecutor;
import dev.oreslang.hat.HatKernelCompiler;
import dev.oreslang.hat.HatKernelIr;
import dev.oreslang.parser.Parser;

public final class HatJavaSmoke {
    public static void main(String[] args) {
        var program = Parser.parse("""
                define pub kernel Add as
                  fnc main(int left, int right): int {
                    return left + right;
                  }
                end
                """);
        var kernels = HatKernelCompiler.compile(program);
        if (kernels.size() != 1) throw new AssertionError("expected one kernel");
        HatKernelIr.Kernel kernel = kernels.getFirst();
        if (!kernel.qualifiedName().equals("__root__.Add")) throw new AssertionError(kernel.qualifiedName());
        if (HatCpuReferenceExecutor.execute(kernel, 19L, 23L) != 42L) throw new AssertionError("bad result");
        String canonical = HatKernelIr.canonical(kernel);
        if (!canonical.contains("ADD_I64(arg(0:left:I64),arg(1:right:I64))"))
            throw new AssertionError(canonical);
        if (HatKernelIr.sha256(kernel).length() != 64) throw new AssertionError("bad digest");

        boolean rejected = false;
        try {
            HatKernelCompiler.compile(Parser.parse("""
                    define kernel Bad as
                      fnc main(int value): int {
                        return helper(value);
                      }
                    end
                    """));
        } catch (IllegalArgumentException expected) {
            rejected = true;
        }
        if (!rejected) throw new AssertionError("unsupported call was admitted");

        boolean overflow = false;
        try {
            HatCpuReferenceExecutor.execute(kernel, Long.MAX_VALUE, 1L);
        } catch (ArithmeticException expected) {
            overflow = true;
        }
        if (!overflow) throw new AssertionError("overflow was not checked");
    }
}
