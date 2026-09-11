#!/usr/bin/env python3
"""
Saby & Beget CRM Production Server Supervisor & Port Bridge.
This supervisor ensures seamless operation with systemd (crm.service) on VPS.
It runs the modern Node.js application (server.js on port 3000) and provides
a transparent TCP bridge from port 3002 to port 3000 for Nginx compatibility.
"""

import os
import sys
import time
import signal
import socket
import shutil
import threading
import subprocess

NODE_PORT = 3000
LISTEN_PORT = int(os.environ.get("CRM_PORT", os.environ.get("PORT", "3002")))

node_process = None


def find_node():
    for candidate in [
        shutil.which("node"),
        shutil.which("nodejs"),
        "/usr/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/nodejs",
    ]:
        if candidate and os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


def forward_stream(source, destination):
    try:
        while True:
            data = source.recv(65536)
            if not data:
                break
            destination.sendall(data)
    except Exception:
        pass
    finally:
        try:
            source.close()
        except Exception:
            pass
        try:
            destination.close()
        except Exception:
            pass


def handle_client(client_sock, target_port):
    try:
        remote_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        remote_sock.connect(("127.0.0.1", target_port))
    except Exception as e:
        sys.stderr.write(f"[CRM Bridge] Connection to backend port {target_port} failed: {e}\n")
        try:
            error_response = (
                b"HTTP/1.1 502 Bad Gateway\r\n"
                b"Content-Type: text/html; charset=utf-8\r\n"
                b"Connection: close\r\n\r\n"
                b"<h1>502 Bad Gateway</h1><p>Starting CRM Node.js service, please refresh in 3 seconds...</p>"
            )
            client_sock.sendall(error_response)
            client_sock.close()
        except Exception:
            pass
        return

    t1 = threading.Thread(target=forward_stream, args=(client_sock, remote_sock), daemon=True)
    t2 = threading.Thread(target=forward_stream, args=(remote_sock, client_sock), daemon=True)
    t1.start()
    t2.start()


def start_port_bridge(listen_port, target_port):
    if listen_port == target_port:
        return

    bridge_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    bridge_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    bridge_sock.bind(("0.0.0.0", listen_port))
    bridge_sock.listen(128)
    print(f"[CRM Bridge] Transparent proxy listening on 0.0.0.0:{listen_port} -> 127.0.0.1:{target_port}")

    while True:
        try:
            client_sock, _ = bridge_sock.accept()
            threading.Thread(target=handle_client, args=(client_sock, target_port), daemon=True).start()
        except Exception as e:
            time.sleep(0.1)


def signal_handler(signum, frame):
    global node_process
    print(f"[CRM Supervisor] Received signal {signum}, stopping Node.js backend...")
    if node_process and node_process.poll() is None:
        node_process.terminate()
        try:
            node_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            node_process.kill()
    sys.exit(0)


def main():
    global node_process
    base_dir = os.path.dirname(os.path.abspath(__file__))
    server_js = os.path.join(base_dir, "server.js")

    if not os.path.isfile(server_js):
        print(f"[CRM Supervisor] Error: server.js not found at {server_js}")
        return 1

    node_bin = find_node()
    if not node_bin:
        print("[CRM Supervisor] Node.js not found in PATH. Attempting automatic installation...")
        try:
            subprocess.run(["apt-get", "update", "-qq"], timeout=60)
            subprocess.run(["apt-get", "install", "-y", "-qq", "nodejs", "npm"], timeout=120)
            node_bin = find_node()
        except Exception as e:
            print(f"[CRM Supervisor] Automatic installation failed: {e}")

    if not node_bin:
        print("[CRM Supervisor] Fatal: nodejs is required to run the modern CRM interface.")
        print("[CRM Supervisor] Please install Node.js: apt update && apt install -y nodejs npm")
        time.sleep(3)
        return 1

    # Configure git safe.directory to prevent dubious ownership errors
    try:
        subprocess.run(["git", "config", "--global", "--add", "safe.directory", "*"], timeout=5, stderr=subprocess.DEVNULL)
    except Exception:
        pass

    # Ensure express, session and nodemailer dependencies are installed
    express_pkg = os.path.join(base_dir, "node_modules", "express")
    nodemailer_pkg = os.path.join(base_dir, "node_modules", "nodemailer")
    if not os.path.isdir(express_pkg) or not os.path.isdir(nodemailer_pkg):
        print("[CRM Supervisor] Dependencies missing. Installing npm packages (express, nodemailer, etc.)...")
        npm_bin = shutil.which("npm") or "/usr/bin/npm"
        if os.path.isfile(npm_bin):
            try:
                subprocess.run([npm_bin, "install", "--omit=dev"], cwd=base_dir, timeout=120)
            except Exception as e:
                print(f"[CRM Supervisor] npm install error: {e}")

    print(f"[CRM Supervisor] Starting Node.js backend ({node_bin} {server_js})...")
    env = os.environ.copy()
    env["PORT"] = str(NODE_PORT)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    node_process = subprocess.Popen(
        [node_bin, server_js],
        cwd=base_dir,
        env=env,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )

    # Start transparent bridge if running on port 3002 (or custom)
    if LISTEN_PORT != NODE_PORT:
        bridge_thread = threading.Thread(
            target=start_port_bridge,
            args=(LISTEN_PORT, NODE_PORT),
            daemon=True,
        )
        bridge_thread.start()

    # Wait for node process to finish
    exit_code = node_process.wait()
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
