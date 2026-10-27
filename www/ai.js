(() => {
  const $ = (id) => document.getElementById(id);

  function getState() {
    try {
      return JSON.parse(localStorage.getItem('afm_v1')) ||
        { tx: [], budgets: [], goals: [] };
    } catch {
      return { tx: [], budgets: [], goals: [] };
    }
  }

  function money(value) {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      maximumFractionDigits: 2
    }).format(value);
  }

  function analyze(message) {
    const data = getState();
    const tx = Array.isArray(data.tx) ? data.tx : [];
    const budgets = Array.isArray(data.budgets) ? data.budgets : [];
    const goals = Array.isArray(data.goals) ? data.goals : [];

    const income = tx
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const expenses = tx
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const balance = income - expenses;
    const text = message.toLowerCase();

    if (/^(hi|hello|hey)\b/.test(text)) {
      return 'Hello! I am AmanFi Finance Assistant. Ask me about your income, expenses, budget, or savings goals.';
    }

    if (/^(akkam|nagaa|akkam jirta)/.test(text)) {
      return 'Akkam Amanuel! Ani AmanFi Finance Assistant dha. Galii, baasii, baajata fi qusannaa kee irratti si gargaaruu nan danda’a.';
    }

    if (/help|garga|maal goch|what can you do/.test(text)) {
      return 'Ani kana irratti si gargaaruu danda’a:\n• Galii fi baasii kee ilaaluu\n• Baajata kee qorachuu\n• Qusannaa kee hordofuu\n• Karoora maallaqaa irratti gorsa bu’uuraa kennuu\n\nGaaffii kee barreessi.';
    }

    if (/income|galii|earnings/.test(text)) {
      return `Your recorded total income is ${money(income)} from ${tx.filter(t => t.type === 'income').length} income transactions.`;
    }

    if (/expense|spend|baasii/.test(text)) {
      return `Your recorded total expenses are ${money(expenses)} from ${tx.filter(t => t.type === 'expense').length} expense transactions.`;
    }

    if (/balance|remaining|hafe|hafte/.test(text)) {
      return `Based on recorded transactions, your balance is ${money(balance)}. This is calculated as total recorded income minus total recorded expenses.`;
    }

    if (/budget|baajata/.test(text)) {
      if (!budgets.length) {
        return 'You have no budgets saved yet. Open the Budgets tab and create a monthly spending limit first.';
      }

      return 'Your saved budgets:\n' + budgets.map(b => {
        const spent = tx
          .filter(t => t.type === 'expense' && t.category === b.category)
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        return `${b.category}: limit ${money(Number(b.amount || b.limit || 0))}; recorded spending ${money(spent)}.`;
      }).join('\n');
    }

    if (/saving|savings|qusann|goal|galma/.test(text)) {
      if (!goals.length) {
        return 'You have no savings goals saved yet. Open Goals and create a goal to start tracking your progress.';
      }

      return 'Your savings goals:\n' + goals.map(g => {
        const target = Number(g.target || g.amount || 0);
        const saved = Number(g.saved || 0);
        const percent = target > 0 ? Math.min(100, saved / target * 100) : 0;
        return `${g.name}: ${money(saved)} saved of ${money(target)} (${percent.toFixed(1)}%).`;
      }).join('\n');
    }

    if (/advice|suggest|gorsa|recommend|analy[sz]/.test(text)) {
      if (income === 0 && expenses === 0) {
        return 'AmanFi keessatti galii fi baasii hin galmeessine. Dura odeeffannoo dhugaa galchi; sana booda xiinxala bu’uuraa siif kennuu nan danda’a.';
      }

      const rate = income > 0 ? ((income - expenses) / income) * 100 : null;
      let advice = `Recorded income: ${money(income)}.\nRecorded expenses: ${money(expenses)}.\nCurrent recorded balance: ${money(balance)}.\n`;

      if (income > 0) {
        advice += `Share remaining after recorded expenses: ${rate.toFixed(1)}%.\n`;
      }

      if (balance < 0) {
        advice += 'Your recorded expenses exceed your recorded income. Review non-essential spending and check that all transactions are accurate.';
      } else if (income > 0 && expenses > income * 0.8) {
        advice += 'Your recorded expenses use more than 80% of your recorded income. Review your categories and set realistic spending limits.';
      } else {
        advice += 'Review your budgets regularly and set a savings goal that fits your actual income and essential expenses.';
      }

      return advice;
    }

    return 'I can help with recorded income, expenses, balance, budgets, and savings goals. Try asking: “Show my expenses”, “What is my balance?”, “Help with my budget”, or “Gorsa maallaqaa naaf kenni”.\n\nNote: I use your locally saved AmanFi data. I am not connected to an online AI service yet.';
  }

  function addMessage(text, role) {
    const messages = $('aiMessages');
    const bubble = document.createElement('div');
    bubble.className = `ai-message ${role}`;
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  function send() {
    const input = $('aiInput');
    const message = input.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    input.value = '';

         addMessage('Thinking...', 'assistant');

    fetch('http://127.0.0.1:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'AI request failed.');
        }
        return data.reply;
      })
      .then(reply => {
        const messages = $('aiMessages');
        if (messages.lastElementChild?.textContent === 'Thinking...') {
          messages.lastElementChild.remove();
        }
        addMessage(reply, 'assistant');
      })
      .catch(error => {
        const messages = $('aiMessages');
        if (messages.lastElementChild?.textContent === 'Thinking...') {
          messages.lastElementChild.remove();
        }
        addMessage('AI connection failed: ' + error.message, 'assistant');
      });

   }

  function init() {
    const page = document.getElementById('aiAssistant');
    if (!page) return;

    if ($('aiMessages') && $('aiForm') && $('aiInput')) {
      const form = $('aiForm');
      if (form.dataset.amanfiReady === 'true') return;
      form.dataset.amanfiReady = 'true';

      addMessage('Welcome to AmanFi! Ask me about your recorded income, expenses, balance, budgets, or savings goals.', 'assistant');

      form.addEventListener('submit', event => {
        event.preventDefault();
        send();
      });
      return;
    }

    page.innerHTML = `
      <p class="eyebrow">YOUR PERSONAL MONEY GUIDE</p>
      <h1>AmanFi Assistant</h1>
      <p class="muted">Ask about your saved income, expenses, budgets, and savings.</p>
      <div class="ai-chat panel">
        <div id="aiMessages" class="ai-messages" aria-live="polite"></div>
        <form id="aiForm" class="ai-form">
          <textarea id="aiInput" rows="2" maxlength="500"
            placeholder="Ask a money question..." required></textarea>
          <button class="goldbtn" type="submit">Send</button>
        </form>
      </div>
      <p class="muted ai-note">Local assistant · Not connected to an online AI service yet.</p>
    `;

    addMessage('Welcome to AmanFi! Ask me about your recorded income, expenses, balance, budgets, or savings goals.', 'assistant');

    $('aiForm').addEventListener('submit', event => {
      event.preventDefault();
      send();
    });
  }

  window.initAmanFiAssistant = init;
  window.addEventListener('DOMContentLoaded', init);
})();
