export const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  underline: "\x1b[4m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

export function success(msg: string): string {
  return `${colors.green}${colors.bold}${msg}${colors.reset}`;
}

export function error(msg: string): string {
  return `${colors.red}${colors.bold}${msg}${colors.reset}`;
}

export function info(msg: string): string {
  return `${colors.cyan}${msg}${colors.reset}`;
}

export function warn(msg: string): string {
  return `${colors.yellow}${msg}${colors.reset}`;
}

export function highlight(msg: string): string {
  return `${colors.magenta}${colors.bold}${msg}${colors.reset}`;
}

export function thinking(msg: string): string {
  return `${colors.gray}${colors.dim}${msg}${colors.reset}`;
}
