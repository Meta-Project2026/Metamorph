// Trusted host subprocess supervision only. No shell, raw stderr or unbounded wait.
using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Metamorph.Mmp125 {
    public sealed class ProcessResult {
        public string Category { get; set; }
        public string Stdout { get; set; } = "";
        public int? ExitCode { get; set; }
        public int ProcessId { get; set; }
        public bool KillRequested { get; set; }
    }

    public static class BoundedProcess {
        // Timeout covers execution AND pipe draining (including inherited pipes).
        // On failure terminate the process tree where supported. Never wait for
        // pipe EOF or process termination without a deadline, including after kill.
        public static ProcessResult Run(string executable, string[] arguments,
                                        int timeoutMs, int maxBytes) {
            return Run(executable, arguments, timeoutMs, maxBytes, CancellationToken.None);
        }
        public static ProcessResult Run(string executable, string[] arguments,
                                        int timeoutMs, int maxBytes, CancellationToken cancellationToken) {
            if (timeoutMs < 1 || maxBytes < 1 || maxBytes > 1048576)
                throw new ArgumentOutOfRangeException();
            var result = new ProcessResult { Category = "UNAVAILABLE" };
            var watch = Stopwatch.StartNew();
            using (var process = new Process())
            using (var output = new MemoryStream())
            using (var cancel = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken)) {
                process.StartInfo.FileName = executable;
                process.StartInfo.UseShellExecute = false;
                process.StartInfo.CreateNoWindow = true;
                process.StartInfo.RedirectStandardOutput = true;
                process.StartInfo.RedirectStandardError = true;
                foreach (var arg in arguments) process.StartInfo.ArgumentList.Add(arg);
                bool started = false;
                ConsoleCancelEventHandler interrupted = (sender, e) => { e.Cancel = true; cancel.Cancel(); };
                Console.CancelKeyPress += interrupted;
                try {
                    started = process.Start();
                    if (!started) return result;
                    result.ProcessId = process.Id;
                    var outBytes = new byte[4096];
                    var errBytes = new byte[4096];
                    var outStream = process.StandardOutput.BaseStream;
                    var errStream = process.StandardError.BaseStream;
                    Task<int> outRead = outStream.ReadAsync(outBytes, 0, outBytes.Length, cancel.Token);
                    Task<int> errRead = errStream.ReadAsync(errBytes, 0, errBytes.Length, cancel.Token);
                    bool outEnd = false, errEnd = false;
                    int received = 0;
                    while (true) {
                        if (cancel.IsCancellationRequested) { result.Category = "CANCELLED"; break; }
                        if (watch.ElapsedMilliseconds >= timeoutMs) {
                            result.Category = "TIMEOUT";
                            break;
                        }
                        if (!outEnd && outRead.IsCompleted) {
                            int count = outRead.GetAwaiter().GetResult();
                            received += count;
                            if (received > maxBytes) { result.Category = "OUTPUT_LIMIT"; break; }
                            if (count == 0) outEnd = true;
                            else {
                                output.Write(outBytes, 0, count);
                                outRead = outStream.ReadAsync(outBytes, 0, outBytes.Length, cancel.Token);
                            }
                        }
                        if (!errEnd && errRead.IsCompleted) {
                            int count = errRead.GetAwaiter().GetResult();
                            received += count;
                            if (received > maxBytes) { result.Category = "OUTPUT_LIMIT"; break; }
                            if (count == 0) errEnd = true;
                            else errRead = errStream.ReadAsync(errBytes, 0, errBytes.Length, cancel.Token);
                            // Stderr bytes are deliberately discarded.
                        }
                        if (process.HasExited && outEnd && errEnd) {
                            result.ExitCode = process.ExitCode;
                            result.Stdout = new UTF8Encoding(false, true).GetString(output.ToArray());
                            result.Category = "EXIT";
                            break;
                        }
                        Thread.Sleep(5);
                    }
                } catch { result.Category = cancel.IsCancellationRequested ? "CANCELLED" : "UNAVAILABLE"; }
                finally {
                    if (started && result.Category != "EXIT") {
                        try {
                            process.Kill(true);
                            result.KillRequested = true;
                        } catch (PlatformNotSupportedException) {
                            try { process.Kill(); result.KillRequested = true; } catch { }
                        } catch { }
                    }
                    cancel.Cancel();
                    Console.CancelKeyPress -= interrupted;
                    // No WaitForExit(), Result or ReadToEnd() on pending tasks.
                }
            }
            return result;
        }
    }
}
