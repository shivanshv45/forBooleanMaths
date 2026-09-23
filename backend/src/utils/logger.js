// keeps worker output readable on camera - [time] [scope] message
function stamp() {
  return new Date().toISOString().slice(11, 19);
}

function write(stream, level, scope, ...parts) {
  stream(`${stamp()} [${scope}] ${level}`, ...parts);
}

const logger = {
  info: (scope, ...parts) => write(console.log, '', scope, ...parts),
  warn: (scope, ...parts) => write(console.warn, 'WARN', scope, ...parts),
  error: (scope, ...parts) => write(console.error, 'ERROR', scope, ...parts),
};

export default logger;
