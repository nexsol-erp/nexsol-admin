// Prints a whole HTML document through a hidden iframe, so no pop-up blocker gets in the way.
export function printHtml(html) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const remove = () => setTimeout(() => frame.remove(), 1000);
  frame.onload = () => {
    const win = frame.contentWindow;
    // Let the logo decode before the print dialog snapshots the page.
    const imgs = [...win.document.images].filter((i) => !i.complete);
    Promise.all(imgs.map((i) => new Promise((r) => { i.onload = r; i.onerror = r; }))).then(() => {
      win.onafterprint = remove;
      win.focus();
      win.print();
      // Some browsers never fire afterprint for iframes.
      setTimeout(remove, 60000);
    });
  };
  frame.srcdoc = html;
}
