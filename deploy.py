import paramiko
import os
import tarfile
import sys

host = '192.168.1.4'
user = 'root'
password = '691015'
remote_dir = '/root/OpenWA_Privado'
local_dir = r'c:\whatsapp\OpenWA'
tar_file = 'openwa_deploy.tar.gz'

print("1. Creating tar archive of local files (excluding node_modules and .git)...")
def exclude_files(tarinfo):
    name = tarinfo.name
    if 'node_modules' in name or '.git' in name or '.wwebjs_cache' in name:
        return None
    return tarinfo

with tarfile.open(tar_file, "w:gz") as tar:
    tar.add(local_dir, arcname='OpenWA_Privado', filter=exclude_files)

print("2. Connecting to server via SSH...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    ssh.connect(host, username=user, password=password, timeout=10)
except Exception as e:
    print(f"Failed to connect: {e}")
    sys.exit(1)

print("3. Uploading tar archive...")
sftp = ssh.open_sftp()
sftp.put(tar_file, '/root/' + tar_file)
sftp.close()

print("4. Extracting and deploying on server...")
commands = [
    f"mkdir -p {remote_dir}",
    f"tar -xzf /root/{tar_file} -C /root",
    f"rm /root/{tar_file}",
    f"cd {remote_dir} && docker compose up -d --build"
]

for cmd in commands:
    print(f"Executing: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out: print(out)
    if err: print(err)
    if exit_status != 0:
        print(f"Error executing command: {cmd}")
        sys.exit(exit_status)

ssh.close()
print("Deployment successful!")
