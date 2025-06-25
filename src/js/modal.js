export function openMAModal(chart) {
    const modal = document.getElementById('ma-modal');
    const overlay = document.getElementById('modal-overlay');
    const inputs = [
        { enabled: 'ma1-enabled', period: 'ma1-period', color: 'ma1-color' },
        { enabled: 'ma2-enabled', period: 'ma2-period', color: 'ma2-color' },
        { enabled: 'ma3-enabled', period: 'ma3-period', color: 'ma3-color' },
    ];

    inputs.forEach((input, index) => {
        document.getElementById(input.enabled).checked = chart.movingAverages[index].enabled;
        document.getElementById(input.period).value = chart.movingAverages[index].period;
        document.getElementById(input.color).value = chart.movingAverages[index].color;
    });

    modal.style.display = 'block';
    overlay.style.display = 'block';
    window.currentChart = chart;

    const cancelBtn = document.querySelector('.cancel-btn');
    const saveBtn = document.querySelector('.save-btn');

    const cancelClone = cancelBtn.cloneNode(true);
    const saveClone = saveBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(cancelClone, cancelBtn);
    saveBtn.parentNode.replaceChild(saveClone, saveBtn);

    cancelClone.addEventListener('click', closeMAModal);
    saveClone.addEventListener('click', () => saveMAModal(chart));
}

export function closeMAModal() {
    const modal = document.getElementById('ma-modal');
    const overlay = document.getElementById('modal-overlay');
    modal.style.display = 'none';
    overlay.style.display = 'none';
    document.getElementById('tool-ma').classList.remove('active');
}

export function saveMAModal(chart) {
    const inputs = [
        { enabled: 'ma1-enabled', period: 'ma1-period', color: 'ma1-color' },
        { enabled: 'ma2-enabled', period: 'ma2-period', color: 'ma2-color' },
        { enabled: 'ma3-enabled', period: 'ma3-period', color: 'ma3-color' },
    ];

    chart.movingAverages = inputs.map(input => {
        const period = parseInt(document.getElementById(input.period).value, 10);
        return {
            enabled: document.getElementById(input.enabled).checked,
            period: isNaN(period) || period < 1 ? 5 : period,
            color: document.getElementById(input.color).value,
        };
    });

    closeMAModal();
    chart.render();
}