// Theme toggle. Dark is the default; a visitor's choice is saved in
// localStorage and restored before paint by the inline script in <head>.
(function () {
  var root = document.documentElement;
  var button = document.querySelector(".theme-toggle");
  var meta = document.querySelector('meta[name="theme-color"]');
  var colors = { dark: "#3d4340", light: "#eeeeee" };

  function apply(theme) {
    root.dataset.theme = theme;
    if (button) button.setAttribute("aria-pressed", String(theme === "light"));
    if (meta) meta.content = colors[theme];
  }

  apply(root.dataset.theme === "light" ? "light" : "dark");

  if (!button) return;
  button.addEventListener("click", function () {
    var next = root.dataset.theme === "light" ? "dark" : "light";
    apply(next);
    try {
      localStorage.setItem("theme", next);
    } catch (e) {}
  });
})();
