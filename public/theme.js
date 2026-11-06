// The docs' light or dark choice, set before the page draws so it never flashes. Stored only in this browser.
(function () { try { var t = localStorage.getItem('isoteh-theme'); if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); } catch (e) { /* storage blocked */ } })();
