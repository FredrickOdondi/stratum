// In-browser Python runtime via Pyodide WebAssembly
// Enables AI consulting agents to run real Python quantitative models (CAGR, unit economics, sensitivity)

declare global {
  interface Window {
    loadPyodide?: (config?: { indexURL?: string }) => Promise<any>;
  }
}

let pyodideInstance: any = null;
let pyodideLoadingPromise: Promise<any> | null = null;

async function getPyodide(): Promise<any> {
  if (pyodideInstance) return pyodideInstance;
  if (pyodideLoadingPromise) return pyodideLoadingPromise;

  pyodideLoadingPromise = (async () => {
    if (typeof window === 'undefined') {
      throw new Error('Pyodide can only run in browser environment');
    }

    if (!window.loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = (e) => reject(new Error(`Failed to load Pyodide script: ${e}`));
        document.head.appendChild(script);
      });
    }

    const pyodide = await window.loadPyodide!({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
    });
    pyodideInstance = pyodide;
    return pyodide;
  })();

  return pyodideLoadingPromise;
}

export interface PythonExecutionResult {
  stdout: string;
  success: boolean;
  error?: string;
}

export async function runPythonAnalytics(code: string): Promise<PythonExecutionResult> {
  if (!code || !code.trim()) {
    return { stdout: '', success: true };
  }

  try {
    const pyodide = await getPyodide();
    let stdoutBuffer = '';

    pyodide.setStdout({
      batched: (text: string) => {
        stdoutBuffer += (stdoutBuffer ? '\n' : '') + text;
      },
    });

    await pyodide.runPythonAsync(code);
    return {
      stdout: stdoutBuffer.trim(),
      success: true,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('Python execution warning:', errorMsg);
    return {
      stdout: '',
      success: false,
      error: errorMsg,
    };
  }
}
