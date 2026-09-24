(function () {
  const form = document.querySelector('form[action="/calculate"]');
  if (!form) return;

  const numberRules = {
    heightCm: { min: 100, max: 250, label: 'Height' },
    actualWeightKg: { min: 30, max: 300, label: 'Actual weight' },
    desiredWeightKg: { min: 30, max: 300, label: 'Desired weight' },
    age: { min: 15, max: 100, label: 'Age' },
  };

  function setError(name, message) {
    const slot = form.querySelector(`[data-error-for="${name}"]`);
    if (!slot) return;
    slot.textContent = message || '';
    slot.classList.toggle('hidden', !message);
  }

  form.addEventListener('submit', (event) => {
    let hasError = false;

    Object.entries(numberRules).forEach(([name, rule]) => {
      const field = form.elements[name];
      const value = Number(field.value);

      if (field.value.trim() === '' || Number.isNaN(value)) {
        setError(name, `${rule.label} is required.`);
        hasError = true;
      } else if (value < rule.min || value > rule.max) {
        setError(name, `${rule.label} must be between ${rule.min} and ${rule.max}.`);
        hasError = true;
      } else {
        setError(name, null);
      }
    });

    ['sex', 'activityLevel'].forEach((name) => {
      if (!form.elements[name].value) {
        setError(name, 'Please make a selection.');
        hasError = true;
      } else {
        setError(name, null);
      }
    });

    if (hasError) event.preventDefault();
  });
})();
