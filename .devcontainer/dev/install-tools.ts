// Runs during an ARM64 image build, after the Dockerfile installs Node.
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const temp = mkdtempSync('/tmp/dev-env-tools-');
function run(program: string, ...args: string[]) {
  execFileSync(program, args, { cwd: temp, stdio: 'inherit' });
}
function version(name: string) {
  const value = process.env[name + '_VERSION'];
  if (!value) throw new Error(`Missing build argument ${name}_VERSION`);
  return value;
}
function download(url: string, path: string) {
  run(
    'curl',
    '--fail',
    '--silent',
    '--show-error',
    '--location',
    '--retry',
    '3',
    '--output',
    path,
    url,
  );
}
function archive(url: string, directory: string, ...args: string[]) {
  download(url, 'archive.tar.gz');
  run('tar', '-xzf', 'archive.tar.gz', '--no-same-owner', '-C', directory, ...args);
}
function binary(url: string, path: string) {
  download(url, path);
  chmodSync(path, 0o755);
}
function systemTools() {
  const bin = '/usr/local/bin';
  const compose = '/usr/local/lib/docker/cli-plugins/docker-compose';
  mkdirSync('/usr/local/lib/docker/cli-plugins', { recursive: true });
  binary(
    `https://github.com/docker/compose/releases/download/v${version('DOCKER_COMPOSE')}/docker-compose-linux-aarch64`,
    compose,
  );
  symlinkSync(compose, join(bin, 'docker-compose'));
  archive(`https://go.dev/dl/go${version('GO')}.linux-arm64.tar.gz`, '/usr/local');

  download('https://packages.cloud.google.com/apt/doc/apt-key.gpg', 'cloud-key');
  run('gpg', '--dearmor', '-o', '/usr/share/keyrings/cloud.google.gpg', 'cloud-key');
  writeFileSync(
    '/etc/apt/sources.list.d/google-cloud-sdk.list',
    'deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main\n',
  );
  mkdirSync('/etc/apt/keyrings', { recursive: true });
  const githubKey = '/etc/apt/keyrings/githubcli-archive-keyring.gpg';
  download('https://cli.github.com/packages/githubcli-archive-keyring.gpg', githubKey);
  chmodSync(githubKey, 0o644);
  writeFileSync(
    '/etc/apt/sources.list.d/github-cli.list',
    `deb [arch=arm64 signed-by=${githubKey}] https://cli.github.com/packages stable main\n`,
  );
  run('apt-get', 'update');
  run('apt-get', 'install', '-y', 'google-cloud-cli', 'gh');
  run('apt-get', 'clean');
  rmSync('/var/lib/apt/lists', { recursive: true, force: true });

  archive(
    `https://mirror.openshift.com/pub/openshift-v4/clients/ocp/${version('OPENSHIFT')}/openshift-client-linux-arm64.tar.gz`,
    bin,
    'oc',
    'kubectl',
  );
  archive(
    `https://github.com/mikefarah/yq/releases/download/v${version('YQ')}/yq_linux_arm64.tar.gz`,
    bin,
    '--transform=s/yq_linux_arm64/yq/',
    './yq_linux_arm64',
  );
  binary(
    `https://github.com/jqlang/jq/releases/download/jq-${version('JQ')}/jq-linux-arm64`,
    join(bin, 'jq'),
  );
  binary(`https://kind.sigs.k8s.io/dl/v${version('KIND')}/kind-linux-arm64`, join(bin, 'kind'));
  archive(
    `https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize/v${version('KUSTOMIZE')}/kustomize_v${version('KUSTOMIZE')}_linux_arm64.tar.gz`,
    bin,
    'kustomize',
  );
  archive(
    `https://github.com/fullstorydev/grpcurl/releases/download/v${version('GRPCURL')}/grpcurl_${version('GRPCURL')}_linux_arm64.tar.gz`,
    bin,
    'grpcurl',
  );
  archive(
    `https://github.com/bufbuild/buf/releases/download/v${version('BUF')}/buf-Linux-aarch64.tar.gz`,
    '/usr/local',
    '--strip-components=1',
  );
  download('https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip', 'aws.zip');
  run('unzip', '-q', 'aws.zip');
  run('./aws/install');
  archive(
    `https://github.com/atuinsh/atuin/releases/download/v${version('ATUIN')}/atuin-aarch64-unknown-linux-gnu.tar.gz`,
    bin,
    '--strip-components=1',
  );
  archive(
    `https://github.com/zellij-org/zellij/releases/download/v${version('ZELLIJ')}/zellij-no-web-aarch64-unknown-linux-musl.tar.gz`,
    bin,
  );
}
function userTools() {
  download(`https://astral.sh/uv/${version('UV')}/install.sh`, 'install-uv.sh');
  run('sh', 'install-uv.sh');
  download('https://claude.ai/install.sh', 'install-claude.sh');
  run('bash', 'install-claude.sh', 'latest');
  download('https://cursor.com/install', 'install-cursor.sh');
  run('bash', 'install-cursor.sh');
  run('go', 'install', `github.com/onsi/ginkgo/v2/ginkgo@v${version('GINKGO')}`);
  run('go', 'install', `golang.org/x/tools/gopls@v${version('GOPLS')}`);
}

try {
  switch (process.argv[2]) {
    case 'system':
      systemTools();
      break;
    case 'user':
      userTools();
      break;
    default:
      throw new Error('usage: install-tools.ts system|user');
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
