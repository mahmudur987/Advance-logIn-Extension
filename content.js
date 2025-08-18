window.addEventListener("load", () => {
  const selects = document.querySelectorAll("select");
  selects.forEach((select, i) => {
    if (select.options.length > 1) select.selectedIndex = 1; // or set by value
  });
});
