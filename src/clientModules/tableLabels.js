// Copies each column header onto its cells as `data-label`, so the stacked
// mobile layout of `.cf-table` (see custom.css) can label every value.
function labelTables() {
  document.querySelectorAll('.cf-table table').forEach((table) => {
    const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach((tr) => {
      [...tr.children].forEach((td, i) => {
        if (heads[i]) td.setAttribute('data-label', heads[i]);
      });
    });
  });
}

export function onRouteDidUpdate() {
  // Wait a frame so the new page's DOM is in place.
  requestAnimationFrame(labelTables);
}
