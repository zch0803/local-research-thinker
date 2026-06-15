using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;

namespace LocalMiroThinkerLauncher
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new LauncherForm());
        }
    }

    internal sealed class LauncherForm : Form
    {
        private readonly Button startButton;
        private readonly Button openButton;
        private readonly Button stopButton;
        private readonly Label statusLabel;
        private readonly Label portLabel;
        private readonly TextBox portBox;
        private readonly Timer statusTimer;
        private Process serverProcess;
        private readonly string configPath;

        public LauncherForm()
        {
            Text = "Local MiroThinker Launcher";
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            ClientSize = new Size(420, 250);
            configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "launcher.config");

            var titleLabel = new Label
            {
                AutoSize = false,
                Text = "Local MiroThinker",
                Font = new Font("Segoe UI", 16f, FontStyle.Bold),
                Location = new Point(24, 22),
                Size = new Size(260, 32)
            };

            var hintLabel = new Label
            {
                AutoSize = false,
                Text = "Start or stop the local service, then open the web app in your browser.",
                ForeColor = Color.FromArgb(90, 100, 120),
                Location = new Point(24, 60),
                Size = new Size(360, 36)
            };

            portLabel = new Label
            {
                AutoSize = false,
                Text = "Port",
                Location = new Point(24, 102),
                Size = new Size(40, 22)
            };

            portBox = new TextBox
            {
                Location = new Point(72, 100),
                Size = new Size(90, 24),
                Text = LoadSavedPort()
            };

            startButton = new Button
            {
                Text = "Start Service",
                Location = new Point(24, 146),
                Size = new Size(112, 34)
            };
            startButton.Click += (_, __) => StartService();

            openButton = new Button
            {
                Text = "Open App",
                Location = new Point(152, 146),
                Size = new Size(112, 34)
            };
            openButton.Click += (_, __) => OpenBrowser();

            stopButton = new Button
            {
                Text = "Stop Service",
                Location = new Point(280, 146),
                Size = new Size(112, 34)
            };
            stopButton.Click += (_, __) => StopService();

            statusLabel = new Label
            {
                AutoSize = false,
                Text = "Status: Stopped",
                Location = new Point(24, 204),
                Size = new Size(360, 24)
            };

            Controls.Add(titleLabel);
            Controls.Add(hintLabel);
            Controls.Add(portLabel);
            Controls.Add(portBox);
            Controls.Add(startButton);
            Controls.Add(openButton);
            Controls.Add(stopButton);
            Controls.Add(statusLabel);

            statusTimer = new Timer { Interval = 1200 };
            statusTimer.Tick += (_, __) => RefreshStatus();
            statusTimer.Start();

            FormClosing += (_, __) => StopService();
            RefreshStatus();
        }

        private void StartService()
        {
            int port = GetPort();
            if (port <= 0)
            {
                return;
            }

            SavePort(port);

            if (IsPortOpen(port))
            {
                statusLabel.Text = "Status: Service already running on http://localhost:" + port;
                RefreshStatus();
                return;
            }

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string appDir = Path.Combine(baseDir, "app");
            string nodePath = ResolveNodePath(baseDir);
            string serverPath = Path.Combine(appDir, "server.js");

            if (!File.Exists(nodePath))
            {
                MessageBox.Show(
                    "node.exe was not found. Expected path:\n" + nodePath,
                    "Missing Runtime",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            if (!File.Exists(serverPath))
            {
                MessageBox.Show(
                    "server.js was not found. Expected path:\n" + serverPath,
                    "Missing App Files",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            var startInfo = new ProcessStartInfo
            {
                FileName = nodePath,
                Arguments = "server.js",
                WorkingDirectory = appDir,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            startInfo.EnvironmentVariables["PORT"] = port.ToString();

            serverProcess = Process.Start(startInfo);
            statusLabel.Text = "Status: Starting service on http://localhost:" + port;
        }

        private void StopService()
        {
            int port = GetPort(false);
            try
            {
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    serverProcess.Kill();
                    serverProcess.WaitForExit(5000);
                }

                foreach (int processId in FindListeningProcessIds(port))
                {
                    try
                    {
                        using (Process process = Process.GetProcessById(processId))
                        {
                            process.Kill();
                            process.WaitForExit(5000);
                        }
                    }
                    catch
                    {
                    }
                }
            }
            catch
            {
            }
            finally
            {
                if (serverProcess != null)
                {
                    serverProcess.Dispose();
                }
                serverProcess = null;
                RefreshStatus();
            }
        }

        private void OpenBrowser()
        {
            int port = GetPort();
            if (port <= 0)
            {
                return;
            }

            Process.Start(new ProcessStartInfo
            {
                FileName = "http://localhost:" + port,
                UseShellExecute = true
            });
        }

        private void RefreshStatus()
        {
            int port = GetPort(false);
            bool isRunning = IsPortOpen(port);
            startButton.Enabled = !isRunning;
            openButton.Enabled = isRunning;
            stopButton.Enabled = isRunning;
            statusLabel.Text = isRunning
                ? "Status: Running at http://localhost:" + port
                : "Status: Stopped";
        }

        private static string ResolveNodePath(string baseDir)
        {
            string bundled = Path.Combine(baseDir, "runtime", "node.exe");
            if (File.Exists(bundled))
            {
                return bundled;
            }

            return "node.exe";
        }

        private int GetPort()
        {
            return GetPort(true);
        }

        private int GetPort(bool showErrors)
        {
            int port;
            if (int.TryParse(portBox.Text.Trim(), out port) && port > 0 && port <= 65535)
            {
                return port;
            }

            if (showErrors)
            {
                MessageBox.Show(
                    "Please enter a valid TCP port between 1 and 65535.",
                    "Invalid Port",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );
            }

            return -1;
        }

        private string LoadSavedPort()
        {
            try
            {
                if (File.Exists(configPath))
                {
                    string value = File.ReadAllText(configPath).Trim();
                    int parsed;
                    if (int.TryParse(value, out parsed) && parsed > 0 && parsed <= 65535)
                    {
                        return parsed.ToString();
                    }
                }
            }
            catch
            {
            }

            return "5173";
        }

        private void SavePort(int port)
        {
            try
            {
                File.WriteAllText(configPath, port.ToString());
            }
            catch
            {
            }
        }

        private static bool IsPortOpen(int port)
        {
            return FindListeningProcessIds(port).Count > 0;
        }

        private static List<int> FindListeningProcessIds(int port)
        {
            var ids = new List<int>();
            if (port <= 0)
            {
                return ids;
            }

            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "netstat.exe",
                    Arguments = "-ano -p tcp",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    CreateNoWindow = true
                };

                using (var process = Process.Start(psi))
                {
                    string output = process.StandardOutput.ReadToEnd();
                    process.WaitForExit(5000);
                    foreach (string line in output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries))
                    {
                        string trimmed = line.Trim();
                        if (!trimmed.StartsWith("TCP", StringComparison.OrdinalIgnoreCase))
                        {
                            continue;
                        }

                        string[] parts = trimmed.Split((char[])null, StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length < 5)
                        {
                            continue;
                        }

                        if (!parts[3].Equals("LISTENING", StringComparison.OrdinalIgnoreCase))
                        {
                            continue;
                        }

                        string localAddress = parts[1];
                        int lastColon = localAddress.LastIndexOf(':');
                        if (lastColon < 0)
                        {
                            continue;
                        }

                        string portPart = localAddress.Substring(lastColon + 1);
                        int foundPort;
                        int processId;
                        if (int.TryParse(portPart, out foundPort) && foundPort == port && int.TryParse(parts[4], out processId))
                        {
                            ids.Add(processId);
                        }
                    }
                }
            }
            catch
            {
            }

            return ids.Distinct().ToList();
        }
    }
}
