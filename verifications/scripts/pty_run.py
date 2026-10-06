#!/usr/bin/env python3
"""Run a command on a new PTY and answer prompts.

getpass reads /dev/tty, so a pipe cannot deliver the KeePass password.
This helper is the interactive half of the dev-env verification harness.

Usage, from the dev-env repo root:

  python3 verifications/scripts/pty_run.py \
    --transcript /path/to/transcript.txt \
    --timeout 30 \
    --expect 'Enter KeePass master password:' --send-file /path/to/password \
    --expect 'All secrets configured successfully!' \
    -- \
    python3 scripts/bootstrap-secrets.py

Each --expect waits for that exact string. Pair it with --send or
--send-file to write a line after the string appears. A final --expect
with no send only waits. The process exit code is preserved. Exit 2
means a prompt was missed or the timeout fired. Sent text is not copied
into the transcript by this helper; a terminal that echoes it still will.
"""

from __future__ import annotations

import errno
import os
import pty
import select
import sys
import time


def parse_args(argv: list[str]) -> tuple[str, float, list[tuple[str, str | None]], list[str]]:
    transcript = ''
    timeout = 30.0
    steps: list[tuple[str, str | None]] = []
    pending_expect: str | None = None
    command: list[str] = []
    index = 0
    while index < len(argv):
        arg = argv[index]
        if arg == '--':
            if pending_expect is not None:
                steps.append((pending_expect, None))
                pending_expect = None
            command = argv[index + 1 :]
            break
        if arg == '--transcript':
            index += 1
            transcript = argv[index]
        elif arg == '--timeout':
            index += 1
            timeout = float(argv[index])
        elif arg == '--expect':
            if pending_expect is not None:
                steps.append((pending_expect, None))
            index += 1
            pending_expect = argv[index]
        elif arg in ('--send', '--send-file'):
            if pending_expect is None:
                raise SystemExit(f'{arg} without --expect')
            index += 1
            if arg == '--send':
                payload = argv[index]
            else:
                payload = open(argv[index], encoding='utf-8').read()
                if payload.endswith('\n'):
                    payload = payload[:-1]
            steps.append((pending_expect, payload + '\n'))
            pending_expect = None
        else:
            raise SystemExit(f'unknown argument: {arg}')
        index += 1
    else:
        raise SystemExit('missing -- before the command')
    if not transcript:
        raise SystemExit('--transcript is required')
    if not command:
        raise SystemExit('missing command after --')
    if pending_expect is not None:
        steps.append((pending_expect, None))
    return transcript, timeout, steps, command


def main() -> None:
    transcript_path, timeout, steps, command = parse_args(sys.argv[1:])
    parent = os.path.dirname(transcript_path)
    if parent:
        os.makedirs(parent, exist_ok=True)

    pid, fd = pty.fork()
    if pid == 0:
        os.execvp(command[0], command)
        raise SystemExit(127)

    buffer = ''
    chunks: list[str] = []
    step_index = 0
    deadline = time.monotonic() + timeout
    timed_out = False
    child_exited = False
    status = 1

    while True:
        if step_index < len(steps) and steps[step_index][0] in buffer:
            expect, send = steps[step_index]
            match_at = buffer.index(expect)
            buffer = buffer[match_at + len(expect) :]
            step_index += 1
            if send is not None:
                os.write(fd, send.encode())
            continue

        if child_exited:
            break

        remaining = deadline - time.monotonic()
        if remaining <= 0:
            timed_out = True
            break

        readable, _, _ = select.select([fd], [], [], min(0.2, remaining))
        if not readable:
            reaped, status = os.waitpid(pid, os.WNOHANG)
            if reaped:
                child_exited = True
            continue

        try:
            raw = os.read(fd, 4096)
        except OSError as exc:
            if exc.errno != errno.EIO:
                raise
            raw = b''
        if not raw:
            child_exited = True
            continue
        text = raw.decode('utf-8', errors='replace')
        chunks.append(text)
        buffer += text

    if not child_exited:
        try:
            os.kill(pid, 15)
        except ProcessLookupError:
            pass
        _, status = os.waitpid(pid, 0)
    else:
        reaped, status = os.waitpid(pid, os.WNOHANG)
        if not reaped:
            _, status = os.waitpid(pid, 0)

    output = ''.join(chunks)
    if timed_out or step_index != len(steps):
        waiting_for = steps[step_index][0] if step_index < len(steps) else ''
        output += f'\n[pty_run timeout or missed prompt waiting for: {waiting_for}]\n'
        with open(transcript_path, 'w', encoding='utf-8') as handle:
            handle.write(output)
        raise SystemExit(2)

    with open(transcript_path, 'w', encoding='utf-8') as handle:
        handle.write(output)

    if os.WIFEXITED(status):
        raise SystemExit(os.WEXITSTATUS(status))
    raise SystemExit(1)


if __name__ == '__main__':
    main()
