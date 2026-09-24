(function () {
  const EYE = 'M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z';
  const PUPIL = 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z';
  const SLASH = 'M3 3l18 18';

  function icon(visible) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5" aria-hidden="true">
              <path d="${EYE}" /><path d="${PUPIL}" />${visible ? `<path d="${SLASH}" />` : ''}
            </svg>`;
  }

  // The button is created here rather than in the templates so that it never
  // appears when scripting is off, where it could not do anything.
  document.querySelectorAll('input[type="password"]').forEach((input) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'relative';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    input.classList.add('pr-12');

    const button = document.createElement('button');
    button.type = 'button';
    button.className =
      'absolute inset-y-0 right-0 px-3.5 flex items-center text-slate-500 ' +
      'hover:text-emerald-400 focus:text-emerald-400 focus:outline-none transition-colors';
    button.innerHTML = icon(false);
    button.setAttribute('aria-label', 'Show password');
    button.setAttribute('aria-pressed', 'false');
    wrapper.appendChild(button);

    button.addEventListener('click', () => {
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.innerHTML = icon(reveal);
      button.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
      button.setAttribute('aria-pressed', String(reveal));

      // Keep the caret where the user left it.
      const end = input.value.length;
      input.focus();
      input.setSelectionRange(end, end);
    });
  });
})();
