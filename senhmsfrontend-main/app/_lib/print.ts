  /**
 * Shared print helper.
 *
 * Prints an HTML document via a hidden <iframe> on the CURRENT page instead of
 * opening a new browser tab. This avoids two long-standing problems with the
 * old `window.open(...) + win.print()` pattern:
 *
 *   1. Pop-up blockers silently killing the print window.
 *   2. An orphaned print tab that never closes if the user leaves the native
 *      print / "Save as PDF" dialog open — which left the app looking frozen.
 *
 * NOTE: The browser's print dialog is inherently modal — while it is open the
 * page's JS is paused. That is unavoidable in any browser. With the iframe
 * approach, once the user clicks Save or Cancel the app resumes immediately and
 * nothing is left hanging. The iframe + its blob URL are always cleaned up,
 * both on `afterprint` and via a safety timeout.
 */
export function printHtml(html: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  iframe.src = url;

  let cleanedUp = false;
  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    // Remove after a short delay so the print job can finish reading the frame.
    setTimeout(() => {
      try { iframe.remove(); } catch { /* ignore */ }
    }, 1000);
  }

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) { cleanup(); return; }
    try {
      win.focus();
      // Resume the app + clean up once the dialog is dismissed (Save or Cancel).
      win.onafterprint = cleanup;
      win.print();
    } catch {
      cleanup();
      return;
    }
    // Safety net: if afterprint never fires (some browsers), clean up anyway.
    setTimeout(cleanup, 60_000);
  };

  document.body.appendChild(iframe);
}

/**
 * Prints several standalone HTML documents as SEPARATE print jobs, one after
 * another. Unlike `printHtmlDocs` (which merges everything into one document /
 * one PDF), this opens one print dialog per document so each can be saved as
 * its own file — used for "Print Selected" lab reports where every test is an
 * individual report.
 *
 * Each document waits for the previous print dialog to close (`afterprint`)
 * before the next one opens, so the hidden iframes never race each other.
 */
export function printHtmlSequential(docs: string[]): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") return Promise.resolve();
  const valid = docs.filter(Boolean);

  return valid.reduce<Promise<void>>(
    (chain, html) => chain.then(() => printOneAwaitable(html)),
    Promise.resolve(),
  );
}

/** Prints a single HTML document and resolves once its print dialog is dismissed. */
function printOneAwaitable(html: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    iframe.src = url;

    let done = false;
    function finish() {
      if (done) return;
      done = true;
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      setTimeout(() => { try { iframe.remove(); } catch { /* ignore */ } }, 500);
      resolve();
    }

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) { finish(); return; }
      try {
        win.focus();
        win.onafterprint = finish;
        win.print();
      } catch {
        finish();
        return;
      }
      // Safety net: resolve anyway if afterprint never fires.
      setTimeout(finish, 60_000);
    };

    document.body.appendChild(iframe);
  });
}

/**
 * Combines several standalone HTML bill documents into ONE printable document
 * and prints it via the same hidden-iframe mechanism as `printHtml`.
 *
 * Why this exists:
 *   The bill builders (`buildOPBillHtml`, `buildCreditBillHtml`) each return a
 *   COMPLETE `<!DOCTYPE html>` document with its own <style> and letterhead.
 *   To print several bills in a single print dialog (e.g. all bills of one
 *   admission) we cannot naively concatenate full documents — that nests
 *   multiple <html>/<body> trees which browsers render inconsistently.
 *
 *   Instead we extract each document's <style> block and the inner content of
 *   its <body>, then stack them under ONE outer shell. Every bill keeps its own
 *   letterhead (the letterhead markup lives inside each body) and a hard page
 *   break is inserted between bills so each starts on a fresh A4 page.
 *
 * Each bill's styles use the same scoped class names across documents, so
 * repeating the (identical) <style> blocks is harmless. The screen-only
 * "Print / Save PDF" buttons are stripped since this prints directly.
 */
export function printHtmlDocs(docs: string[]): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const valid = docs.filter(Boolean);
  if (valid.length === 0) return;
  if (valid.length === 1) { printHtml(valid[0]); return; }

  const styleOf = (html: string): string => {
    const styles = html.match(/<style[\s\S]*?<\/style>/gi);
    return styles ? styles.join("\n") : "";
  };
  const bodyOf = (html: string): string => {
    const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    let inner = m ? m[1] : html;
    // Drop the screen-only print button so the combined doc prints cleanly.
    inner = inner.replace(/<button[^>]*class="[^"]*print-btn[^"]*"[\s\S]*?<\/button>/gi, "");
    return inner;
  };

  // Collect unique style blocks (bills share identical CSS, so dedupe).
  const seenStyles = new Set<string>();
  const styleBlocks: string[] = [];
  for (const d of valid) {
    const s = styleOf(d);
    if (s && !seenStyles.has(s)) { seenStyles.add(s); styleBlocks.push(s); }
  }

  const PAGE_BREAK = '<div style="page-break-before:always"></div>';
  const bodies = valid.map(bodyOf).join(PAGE_BREAK);

  const combined = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Bills</title>
  ${styleBlocks.join("\n")}
</head>
<body>
${bodies}
</body>
</html>`;

  printHtml(combined);
}
