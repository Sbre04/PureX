/**
 * X AI FORENSIC ENGINE - v22.0 SPECIFIC PATTERN FIX + SCROLL FIX
 * Features: Detects Em-Dashes (—), Rhetorical Questions, improved Comparative Copy
 * Fixes: DOM Virtualization handling for infinite scroll
 */

let autoCleanEnabled = false; 
let detectionEnabled = true;
let localWhitelist = []; 
let keywordsConfig = { marketing_hooks: [], ai_models: [], spam_patterns: [], gpt_isms: [], structural_triggers: [], sales_patterns: [] };

// Questi sono i valori di partenza. L'estensione li modificherà nel tempo.
let learningWeights = {
    sentiment_high: 20, // Quanto pesa l'iper-entusiasmo
    sentiment_flat: 15, // Quanto pesa la neutralità robotica
    structure: 25,      // Quanto pesano elenchi ed em-dash
    sales: 30,          // Quanto pesa il copy di vendita
    vocab: 15,          // Quanto pesano le parole GPT (delve, tapestry...)
    marketing: 30,      // Quanto pesa l'engagement bait
    rhythm: 20          // Quanto pesa la burstiness (ritmo robotico)
};

const REPORT_WEBHOOK_URL = "https://purex-proxy.vercel.app/api/proxy"; 

const initEngine = async () => {
    const data = await new Promise(resolve => {
        chrome.storage.local.get(['autoClean', 'isActive', 'whitelistedUsers', 'learningWeights'], resolve);
    });

    autoCleanEnabled = !!data.autoClean;
    detectionEnabled = data.isActive !== false;
    localWhitelist = data.whitelistedUsers || [];

    if (data.learningWeights) {
        learningWeights = data.learningWeights;
        console.log("Adaptive Learning: Pesi caricati", learningWeights);
    }

    try {
        const url = chrome.runtime.getURL('keywords.json');
        const response = await fetch(url);
        keywordsConfig = await response.json();
    } catch (e) {
        keywordsConfig.gpt_isms = ["delve", "tapestry", "unleash"];
    }

    initObserver();
    setTimeout(forceRescan, 500);
};

chrome.storage.onChanged.addListener((changes) => {
    if (changes.autoClean) {
        autoCleanEnabled = changes.autoClean.newValue;
        forceRescan();
    }
    if (changes.whitelistedUsers) localWhitelist = changes.whitelistedUsers.newValue || [];
});

function forceRescan() {
    document.querySelectorAll('article[data-testid="tweet"]').forEach(t => {
        t.removeAttribute('data-ai-visual-state');
        t.removeAttribute('data-ai-last-content');
        const clone = t.querySelector('.ai-cloned-text-container');
        if(clone) clone.remove();
        t.querySelectorAll('.ai-media-curtain').forEach(el => el.remove());
        t.querySelectorAll('.ai-score-wrapper').forEach(el => el.remove());
        t.querySelectorAll('.ai-missed-report-btn').forEach(el => el.remove());
        const originalText = t.querySelector('[data-testid="tweetText"]');
        if(originalText) originalText.classList.remove('ai-original-hidden');
        t.classList.remove('ai-blurred', 'ai-revealed');
        if(t.style.display === "none") t.style.display = "";
    });
    scan();
}

function detectAIStructure(text) {
    let structureScore = 0;
    const baseWeight = learningWeights.structure;
    
    // 1. Elenchi Emoji
    const emojiListMatch = text.match(/^[\p{Emoji}\u200d]+/gm);
    if (emojiListMatch && emojiListMatch.length >= 3) structureScore += baseWeight;

    // 2. Elenchi Standard
    const dashListMatch = text.match(/^\s*[-•]\s+.+/gm);
    const numListMatch = text.match(/^\s*\d+\.\s+.+/gm);
    if (dashListMatch && dashListMatch.length >= 3) structureScore += (baseWeight * 0.8);
    if (numListMatch && numListMatch.length >= 3) structureScore += (baseWeight * 0.8);

    // 3. Intestazioni
    if (/[A-Z][a-z\s]+:\n/.test(text)) structureScore += (baseWeight * 0.6);

    // 4. EM-DASH
    if (text.includes(" — ")) {
        structureScore += (baseWeight * 0.6); 
    }

    return structureScore;
}

function detectSalesCopy(text) {
    let salesScore = 0;
    const baseWeight = learningWeights.sales;
    
    // 1. Frasi "Staccato"
    const shortSentences = text.match(/[A-Z][^.!?]{5,30}[.!?]/g);
    if (shortSentences && shortSentences.length >= 3) {
        salesScore += baseWeight; 
    }

    // 2. Domande Retoriche
    if (/^(Are you|Still|Do you want|Tired of|Ready to).+\?/.test(text)) {
        salesScore += (baseWeight * 0.6);
    }

    // 3. Pattern specifici
    if (keywordsConfig.sales_patterns) {
        const txtLower = text.toLowerCase();
        let matches = 0;
        keywordsConfig.sales_patterns.forEach(pat => {
            if (txtLower.includes(pat)) matches++;
        });
        if (matches > 0) salesScore += (matches * (baseWeight * 0.5));
    }

    return salesScore;
}

function detectHumanSignals(text) {
    let humanScore = 0;
    const txtLower = text.toLowerCase();

    if (/[a-z][,.;][a-z]/.test(text)) humanScore += 30; 
    if (/(.)\1{2,}/.test(text)) humanScore += 25;

    const slang = ["idk", "rn", "bc", "tho", "plz", "tbh", "afaik", "bruh", "lol", "lmao", "wtf", "ngl"];
    if (slang.some(s => txtLower.includes(` ${s} `) || txtLower.startsWith(`${s} `))) humanScore += 20;

    return humanScore;
}

function getBurstiness(text) {
    try {
        if (text.length < 50) return 0;
        const sentences = text.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 0);
        if (sentences.length < 3) return 0;
        
        const lengths = sentences.map(s => s.length);
        const avg = lengths.reduce((a, b) => a + b) / lengths.length;
        const variance = lengths.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / lengths.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev < 15) return 20;
        return 0;
    } catch (e) { return 0; }
}

function calculateForensicAnalysis(text) {
    let score = 0;
    let reasons = [];
    const txt = text.toLowerCase().trim();

    // Analisi emozioni dei post
    if (typeof vaderSentiment !== 'undefined') {
        try {
            const sentiment = vaderSentiment.SentimentIntensityAnalyzer.polarity_scores(text);
            
            if (sentiment.compound > 0.85) {
                score += learningWeights.sentiment_high;
                reasons.push(`Hyper-Enthusiasm (Sentiment: ${sentiment.compound})`);
            }
            
            if (text.length > 100 && Math.abs(sentiment.compound) < 0.05 && Math.abs(sentiment.neu) > 0.95) {
                score += learningWeights.sentiment_flat;
                reasons.push("Robotic Neutrality");
            }

            if (sentiment.compound < -0.6) {
                score -= 15; 
            }
        } catch (e) {}
    }

    // 1. Vocabolario 
    let aiWordCount = 0;
    if (keywordsConfig.gpt_isms) {
        keywordsConfig.gpt_isms.forEach(word => { if (txt.includes(word)) aiWordCount++; });
    }
    if (aiWordCount > 0) {
        const points = Math.min(aiWordCount * learningWeights.vocab, 45);
        score += points;
        reasons.push(`AI Vocabulary (${aiWordCount})`);
    }

    // 2. Marketing
    if (keywordsConfig.marketing_hooks && keywordsConfig.marketing_hooks.some(k => txt.includes(k))) {
        score += learningWeights.marketing;
        reasons.push("Engagement Bait");
    }

    // 3. Struttura
    const structScore = detectAIStructure(text);
    if (structScore > 0) {
        score += structScore;
        reasons.push("AI Formatting Structure");
    }

    // 4. Copy di Vendita
    const salesScore = detectSalesCopy(text);
    if (salesScore > 0) {
        score += salesScore;
        reasons.push("Sales/Productivity Copy");
    }

    // 5. Ritmo
    const rhythmScore = getBurstiness(text);
    if (rhythmScore > 0) {
        score += learningWeights.rhythm;
        reasons.push("Robotic Rhythm");
    }

    // 6. Menzione Modelli AI
    if (keywordsConfig.ai_models && keywordsConfig.ai_models.some(k => txt.includes(k))) {
        score += 20; 
    }

    // 7. Segnali Umani
    const humanPoints = detectHumanSignals(text);
    if (humanPoints > 0) {
        score -= humanPoints;
    }

    return { score: Math.max(0, Math.min(score, 100)), reasons };
}

// Logica apprendimento
function learnFromMistake(text, mistakeType) {
    const analysis = calculateForensicAnalysis(text); 
    const reasonsStr = analysis.reasons.join(" ");

    const adjustWeight = (key, delta) => {
        learningWeights[key] = Math.max(5, Math.min(50, learningWeights[key] + delta));
    };

    const delta = mistakeType === "MISSED_AI" ? 2 : -2; 

    if (reasonsStr.includes("Hyper-Enthusiasm")) adjustWeight('sentiment_high', delta);
    if (reasonsStr.includes("Robotic Neutrality")) adjustWeight('sentiment_flat', delta);
    if (reasonsStr.includes("Structure")) adjustWeight('structure', delta);
    if (reasonsStr.includes("Sales")) adjustWeight('sales', delta);
    if (reasonsStr.includes("Vocabulary")) adjustWeight('vocab', delta);
    if (reasonsStr.includes("Engagement")) adjustWeight('marketing', delta);
    if (reasonsStr.includes("Rhythm")) adjustWeight('rhythm', delta);

    if (mistakeType === "MISSED_AI" && analysis.reasons.length === 0) {
        adjustWeight('structure', 1);
        adjustWeight('vocab', 1);
        adjustWeight('sales', 1);
    }

    console.log(`🧠 AI Learned (${mistakeType}). New Weights:`, learningWeights);
    chrome.storage.local.set({ learningWeights: learningWeights });
}

// -helpers per reset visuali
function resetVisuals(tweet, textNode) {
    const clone = tweet.querySelector('.ai-cloned-text-container');
    if(clone) clone.remove();
    tweet.querySelectorAll('.ai-media-curtain').forEach(el => el.remove());
    
    if(textNode) {
        textNode.classList.remove('ai-original-hidden');
        const oldReport = textNode.parentNode.querySelector('.ai-report-container');
        if(oldReport) oldReport.remove();
    }
    
    tweet.classList.remove('ai-blurred', 'ai-revealed');
    tweet.setAttribute('data-ai-visual-state', 'visible');
    if(tweet.style.display === "none") tweet.style.display = "";
}

// processa ogni tweet

function processTweet(tweet) {
    const textNode = tweet.querySelector('[data-testid="tweetText"]');
    if (!textNode) return;

    const tweetContent = textNode.innerText;
    const lastContent = tweet.getAttribute('data-ai-last-content');
    
    // 1. Ottimizzazione: Se il contenuto è identico e c'è già analisi, skip
    if (lastContent === tweetContent && tweet.querySelector('.ai-score-wrapper')) {
        // Se è già rivelato, assicurati solo che il bottone report esista
        if (tweet.classList.contains('ai-revealed')) {
            const target = tweet.querySelector('[data-testid="User-Name"]');
            if (target && !textNode.parentNode.querySelector('.ai-report-container')) {
                 addReportButton(textNode, target, tweetContent, parseInt(tweet.getAttribute('data-ai-probability') || 0));
            }
        }
        return;
    }

    // 2. Calcola il punteggio PRIMA di modificare il DOM
    const analysis = calculateForensicAnalysis(tweetContent);
    const score = analysis.score;
    const isHighRisk = score >= 50;

    // Aggiorna memoria
    tweet.setAttribute('data-ai-last-content', tweetContent);
    tweet.setAttribute('data-ai-probability', score);

    // Pulizia dei vecchi indicatori visivi (triangoli/bottoni)
    tweet.querySelectorAll('.ai-score-wrapper').forEach(el => el.remove());
    tweet.querySelectorAll('.ai-missed-report-btn').forEach(el => el.remove());

    const target = tweet.querySelector('[data-testid="User-Name"]');
    if (!target) return;

    // Whitelist check
    const authorLink = target.querySelector('a');
    let handle = "Unknown";
    if (authorLink) {
        handle = authorLink.getAttribute('href');
        if (localWhitelist.includes(handle)) {
            resetVisuals(tweet, textNode); // Se whitelistato, pulisci tutto immediatamente
            return; 
        }
    }

    // 3. Renderizza il triangolo di avviso
    if (tweet.style.display !== "none") {
        let wrapper = document.createElement('div');
        wrapper.className = 'ai-score-wrapper';
        target.style.overflow = "visible";
        
        const status = score >= 70 ? 'critical' : (score >= 40 ? 'warning' : 'safe');
        const reasonsHTML = analysis.reasons && analysis.reasons.length > 0 
            ? analysis.reasons.map(r => `<li>${r}</li>`).join('') 
            : "<li>Verified Human Pattern</li>";

        wrapper.innerHTML = `
            <div class="ai-triangle ${status}"></div>
            <div class="ai-tooltip-pro">
                <div class="ai-prob">AI Score: ${score}%</div>
                <ul class="ai-reasons-list">${reasonsHTML}</ul>
            </div>`;
        
        target.appendChild(wrapper);

        if (score < 50) {
            const reportBtn = document.createElement('div');
            reportBtn.className = 'ai-missed-report-btn';
            reportBtn.innerHTML = '!'; 
            reportBtn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation(); 
                if(confirm("Segnalare come AI non rilevata?")) {
                    sendMissedReport(handle, tweetContent, score);
                    learnFromMistake(tweetContent, "MISSED_AI");
                    reportBtn.innerHTML = "✓";
                    setTimeout(forceRescan, 1500);
                }
            });
            target.appendChild(reportBtn);
        }
    }

    // 4. GESTIONE SFOCATURA 
    if (isHighRisk && !tweet.classList.contains('ai-revealed') && !autoCleanEnabled) {
        // È AI: Applica/Aggiorna la sfocatura (swap senza mostrare originale)
        applyAction(tweet, textNode, target, tweetContent, score);
    } else {
        // È Umano o Rivelato: Mostra il contenuto
        if (!tweet.classList.contains('ai-revealed')) {
             resetVisuals(tweet, textNode);
        } else {
             // Se è rivelato, assicurati che il bottone Falso Positivo ci sia
             addReportButton(textNode, target, tweetContent, score);
        }
    }

    if (autoCleanEnabled && isHighRisk) {
        tweet.style.display = "none";
        incrementCounter();
    }
}

function sendMissedReport(handle, content, score) {
    if (!REPORT_WEBHOOK_URL) return;
    const payload = {
        username: "Pure X Sentinel",
        avatar_url: "https://i.imgur.com/4M34hi2.png",
        embeds: [{
            title: "⚠️ Missed AI Detection Reported",
            color: 16766720, 
            fields: [
                { name: "Suspect Handle", value: `\`${handle}\``, inline: true },
                { name: "Current Score", value: `${score}% (Low)`, inline: true },
                { name: "Content", value: content ? content.substring(0, 1000) : "No text" }
            ],
            footer: { text: "User Manual Report v22.0" },
            timestamp: new Date().toISOString()
        }]
    };
    fetch(REPORT_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(console.error);
}

function hideMedia(tweet) {
    const mediaSelectors = ['[data-testid="tweetPhoto"]','[data-testid="videoPlayer"]','[data-testid="card.wrapper"]'];
    mediaSelectors.forEach(sel => {
        tweet.querySelectorAll(sel).forEach(mediaContainer => {
            if (mediaContainer.querySelector('.ai-media-curtain')) return;
            mediaContainer.style.position = 'relative';
            const curtain = document.createElement('div');
            curtain.className = 'ai-media-curtain';
            mediaContainer.appendChild(curtain);
        });
    });
}

function applyAction(tweet, textNode, headerTarget, tweetContent, score) {
    if (tweet.classList.contains('ai-revealed')) return;

    // Rimuovi eventuali cloni VECCHI prima di aggiungerne uno nuovo
    // MA NON rimuovere la classe 'ai-original-hidden' dal nodo originale ancora!
    const oldClone = tweet.querySelector('.ai-cloned-text-container');
    if(oldClone) oldClone.remove();

    tweet.classList.add('ai-blurred');
    tweet.setAttribute('data-ai-visual-state', 'blurred');

    // Crea il nuovo clone
    const clone = textNode.cloneNode(true);
    clone.className = 'ai-cloned-text-container';
    clone.removeAttribute('data-testid');
    
    const overlay = document.createElement('div');
    overlay.className = 'ai-glass-overlay';
    
    const showBtn = document.createElement('button');
    showBtn.className = 'ai-blur-overlay-btn';
    showBtn.innerText = `View AI Content`; 
    
    overlay.appendChild(showBtn);
    clone.appendChild(overlay);

    // Inserisci il clone e nascondi l'originale nello stesso ciclo
    textNode.parentNode.insertBefore(clone, textNode.nextSibling);
    textNode.classList.add('ai-original-hidden'); // Assicura che sia nascosto

    hideMedia(tweet);

    if (!tweet.hasAttribute('data-ai-counted')) {
        incrementCounter();
        tweet.setAttribute('data-ai-counted', 'true');
    }

    showBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        clone.remove();
        tweet.querySelectorAll('.ai-media-curtain').forEach(el => el.remove());
        textNode.classList.remove('ai-original-hidden');
        
        tweet.classList.remove('ai-blurred');
        tweet.classList.add('ai-revealed');
        tweet.setAttribute('data-ai-visual-state', 'visible');

        addReportButton(textNode, headerTarget, tweetContent, score);
    });
}

function addReportButton(container, headerTarget, content, score) {
    if(container.querySelector('.ai-report-container')) return;

    const reportDiv = document.createElement('div');
    reportDiv.className = 'ai-report-container';
    reportDiv.innerHTML = `<button class="ai-report-btn">False Positive?</button>`;
    container.appendChild(reportDiv);

    const btn = reportDiv.querySelector('button');

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if(confirm("Segnalare come Falso Positivo e aggiungere alla Whitelist?")) {
            const authorLink = headerTarget.querySelector('a');
            let handle = "Unknown";
            if(authorLink) {
                handle = authorLink.getAttribute('href');
                if (!localWhitelist.includes(handle)) {
                    localWhitelist.push(handle);
                    chrome.storage.local.set({ whitelistedUsers: localWhitelist });
                }
            }
            learnFromMistake(content, "FALSE_POSITIVE");
            btn.disabled = true;
            btn.innerText = "Learning...";
            
            const payload = {
                username: "Pure X Report Bot",
                avatar_url: "https://i.imgur.com/4M34hi2.png",
                embeds: [{
                    title: "🚨 False Positive Reported",
                    color: 16711680,
                    fields: [
                        { name: "User Handle", value: `\`${handle}\``, inline: true },
                        { name: "AI Confidence", value: `**${score}%**`, inline: true },
                        { name: "Detected Content", value: content ? content.substring(0, 1000) : "No text" }
                    ],
                    footer: { text: "Pure X Extension v22.0" },
                    timestamp: new Date().toISOString()
                }]
            };

            fetch(REPORT_WEBHOOK_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            }).then(() => {
                reportDiv.innerHTML = `<span style="color:#10b981; font-size:11px;">✅ Report Sent & Whitelisted</span>`;
                setTimeout(() => forceRescan(), 1000);
            }).catch(err => {
                reportDiv.innerHTML = `<span style="color:#10b981; font-size:11px;">✅ Whitelisted</span>`;
                setTimeout(() => forceRescan(), 1000);
            });
        }
    });
}

function incrementCounter() {
    chrome.storage.local.get(['botCount'], (data) => {
        chrome.storage.local.set({ botCount: (data.botCount || 0) + 1 });
    });
}

const scan = () => {
    if (!detectionEnabled) return;
    document.querySelectorAll('article[data-testid="tweet"]').forEach(processTweet);
};

// --- FIX OBSERVER: DEBOUNCE PER SCROLL FLUIDO ---
let scanTimeout;
const initObserver = () => {
    const targetNode = document.body;
    if (!targetNode) { setTimeout(initObserver, 50); return; }

    const observer = new MutationObserver(() => {
        clearTimeout(scanTimeout);
        scanTimeout = setTimeout(() => {
            window.requestAnimationFrame(scan);
        }, 100); 
    });

    observer.observe(targetNode, { childList: true, subtree: true });
    scan();
    setInterval(scan, 2000);
};

initEngine();

chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "FORCE_UPDATE_VIEW") {
        chrome.storage.local.get(['autoClean'], (data) => {
            autoCleanEnabled = !!data.autoClean;
            forceRescan();
        });
    }
});