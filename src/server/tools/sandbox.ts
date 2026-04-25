import vm from 'node:vm';

export function executeJavaScript(code: string): { output: string; error: string | null } {
  let output = '';
  
  // Create a safe, isolated context with only basic primitives
  const sandbox = {
    console: {
      log: (...args: any[]) => {
        output += args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n';
      },
      error: (...args: any[]) => {
        output += 'ERROR: ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n';
      }
    },
    Math: Math,
    Date: Date,
    JSON: JSON,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    Boolean: Boolean
  };

  try {
    const context = vm.createContext(sandbox);
    // Hard execution timeout: 2000ms
    vm.runInContext(code, context, { timeout: 2000 });
    return { output: output.trim(), error: null };
  } catch (err: any) {
    return { output: output.trim(), error: err.message || 'Execution failed' };
  }
}
