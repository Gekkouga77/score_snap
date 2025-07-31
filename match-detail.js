const urlParams = new URLSearchParams(window.location.search);
const matchId = urlParams.get("matchId");

function goBack() {
  window.history.back();
}

function retryAgain() {
  location.reload();
}

function getInitials(name) {
  if (typeof name !== "string" || !name.trim()) return "??"

  const parts = name.trim().split(" ").filter(p => p); 

  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase(); 
  if (parts.length > 0) return parts[0].substring(0, 2).toUpperCase(); 

  return "??";
}

function formatSingleDate(n) {
  if (!n) return "";
  const t = new Date(parseInt(n));
  return `${t.getDate()} ${t.toLocaleString("default", {month: "short"})}`;
}

function formatDateRange(n, t) {
  if (!n || !t) return "";

  const e = new Date(parseInt(n));
  const o = new Date(parseInt(t));

  return e.toDateString() === o.toDateString() ? 
    formatSingleDate(n) : `${e.getDate()}-${o.getDate()} ${e.toLocaleString("default", {month: "short"})}`;
}

function formatMatchDate(n, t, e) {
  return "TEST" === n ? formatDateRange(t, e) : formatSingleDate(t);
}

function formatHeaderScore(n) {
  return n ? 0 === n.totalRuns && 0 === n.wickets && 0 === parseFloat(n.overs) ? 
      "" : 10 === n.wickets ? `${n.totalRuns}` : `${n.totalRuns}/${n.wickets}` : "";
}

Promise.all([
  fetch(`https://cricbuzz-cricket.p.rapidapi.com/mcenter/v1/${matchId}/scard`, {
    method: "GET",
    headers: {
      "x-rapidapi-key": "ade6db22c2msh5675acc6a0a4be5p19773djsne8eab3f14f00",
      "x-rapidapi-host": "cricbuzz-cricket.p.rapidapi.com"
    }
  }).then(res => res.json()),
  fetch("https://cricbuzz-cricket.p.rapidapi.com/matches/v1/live", {
    method: "GET",
    headers: {
      "x-rapidapi-key": "ade6db22c2msh5675acc6a0a4be5p19773djsne8eab3f14f00",
      "x-rapidapi-host": "cricbuzz-cricket.p.rapidapi.com"
    }
  }).then(res => res.json())
]).then(([detailData, liveData]) => {
  const metaMatches = liveData.typeMatches.flatMap(typeMatch =>
    typeMatch.seriesMatches.flatMap(seriesMatch =>
      (seriesMatch.seriesAdWrapper?.matches || [])));

  const matched = metaMatches.find(m => String(m.matchInfo?.matchId) === matchId);
  const meta = matched?.matchInfo;
  
  if (!detailData.scoreCard || !meta) {
    document.getElementById("loadingState").style.display = "none";
    document.getElementById("errorState").style.display = "block";
    return;
  }
  
  const inningsData = extractInningsAndBowlers(detailData.scoreCard);
  document.getElementById("loadingState").style.display = "none";
  document.getElementById("matchContent").style.display = "block";
  renderMatchHeader(meta, inningsData);
  renderTabs(inningsData);

  const backButtonTextElement = document.getElementById("back-button-text");
  if (backButtonTextElement && meta.team1?.teamName && meta.team2?.teamName) {
    backButtonTextElement.textContent = `${meta.team1.teamName} vs ${meta.team2.teamName}`;} 
  else if (backButtonTextElement) {
    backButtonTextElement.textContent = "Back to Matches";}
}).catch(err => {
  console.error("Error loading match details:", err);
  document.getElementById("loadingState").style.display = "none";
  document.getElementById("errorState").style.display = "block";
});

function extractInningsAndBowlers(scoreCard = []) {
  return scoreCard.map(inng => {
    const batTeamDetails = inng.batTeamDetails || {};
    const bowlTeamDetails = inng.bowlTeamDetails || {};
    const scoreDetails = inng.scoreDetails || {};
    const extrasData = inng.extrasData || {};
    
    const allBatsmenSource = Object.values(batTeamDetails.batsmenData || {});

    const actualBatters = allBatsmenSource.filter(p => 
      (p.balls && parseInt(p.balls, 10) > 0) || (p.outDesc && p.outDesc.toLowerCase() !== "not out"));

    const yetToBatFromMainList = allBatsmenSource.filter(p => 
      (!p.balls || parseInt(p.balls, 10) === 0) && (!p.outDesc || p.outDesc.toLowerCase() === "not out"));

    const yetToBatFromApiList = Object.values(batTeamDetails.yetToBat || {});

    const allYetToBatNames = new Set([
      ...yetToBatFromMainList.map(p => p.batName),
      ...yetToBatFromApiList.map(p => p.playerName)
    ]);
    
    const batting = actualBatters.map(p => ({ 
      name: p.batName, 
      runs: p.runs, 
      balls: p.balls, 
      fours: p.fours, 
      sixes: p.sixes, 
      strikeRate: p.strikeRate, 
      dismissal: p.outDesc || "not out" }
    ));

    const yetToBat = Array.from(allYetToBatNames).join(" · ");

    const bowling = Object.values(bowlTeamDetails.bowlersData || {}).map(b => ({ 
      name: b.bowlName, 
      overs: b.overs, 
      maidens: b.maidens, 
      runs: b.runs, 
      wickets: b.wickets, 
      economy: b.economy 
    }));

    const fow = Object.values(inng.wicketsData || {}).map(w => 
      `${w.wktRuns}/${w.wktNbr} (${w.batName}, ${w.wktOver} ov)`
    );
    
    return {
      inningNumber: inng.inningsId, 
      battingTeam: batTeamDetails.batTeamName || "N/A", 
      totalRuns: scoreDetails.runs || 0, 
      wickets: scoreDetails.wickets || 0, 
      overs: scoreDetails.overs || "0.0", 
      extras: { 
        total: extrasData.total || 0, 
        details: `(NB ${extrasData.noBalls || 0}, W ${extrasData.wides || 0}, LB ${extrasData.legByes || 0})`
      }, 
      batting, 
      bowling, 
      fallOfWickets: fow.join(" · "), 
      yetToBat
    };
  });
}

async function loadTeamLogo(team, imgElement) {
  if (!team || !team.imageId || !imgElement) {
    imgElement.parentElement.innerHTML = team.teamSName || "??";
    return;
  }
  
  const url = `https://cricbuzz-cricket.p.rapidapi.com/img/v1/i1/c${team.imageId}/i.jpg`;
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": "ade6db22c2msh5675acc6a0a4be5p19773djsne8eab3f14f00",
      "x-rapidapi-host": "cricbuzz-cricket.p.rapidapi.com"
    }
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error("Image obtainment failed");
    const blob = await response.blob();
    imgElement.src = URL.createObjectURL(blob);} 
  catch (error) {
    console.error("Could not load team logo:", error);
    imgElement.onerror(); }
}

function handleImageError(element, fallbackText) {
  const parent = element.parentElement;
  parent.innerHTML = fallbackText;

  const textLength = fallbackText.length;
  if (textLength > 3) {
    const scale = Math.max(0.5, 3 / textLength);
    parent.style.transform = `scale(${scale})`;
  }
}

function applyLogoFallback(parentElement, fallbackText) {
  if (!parentElement) return;

  parentElement.innerHTML = `<span>${fallbackText}</span>`;
  const textSpan = parentElement.querySelector('span');
  
  textSpan.style.display = 'inline-block';

  const textLength = fallbackText.length;
  if (textLength > 3) {
    const scale = Math.max(0.4, 2.7 / textLength);
    textSpan.style.transform = `scale(${scale})`;
  }
}

async function renderMatchHeader(meta, innings) {
  const container = document.getElementById("match-meta");
  if (!meta) {
    container.style.display = "none";
    return;
  }
  
  const team1Innings = innings.filter(i => i.battingTeam === meta.team1.teamName).sort((a, b) => a.inningNumber - b.inningNumber);
  const team2Innings = innings.filter(i => i.battingTeam === meta.team2.teamName).sort((a, b) => a.inningNumber - b.inningNumber);
  const isTestMatch = meta.matchFormat === "TEST";

  const hasFirstInnings = team1Innings.length > 0 || team2Innings.length > 0;
  const hasSecondInnings = team1Innings.length > 1 || team2Innings.length > 1;

  const generateScoreHTML = (teamInnings) => {
    if (isTestMatch) {
      let scoresHTML = '';
      if (hasFirstInnings) {
        const s1 = formatHeaderScore(teamInnings[0]);
        scoresHTML += s1 ? `<div>${s1}</div>` : `<div class="score-placeholder">0</div>`;
      }
      if (hasSecondInnings) {
        const s2 = formatHeaderScore(teamInnings[1]);
        scoresHTML += s2 ? `<div>${s2}</div>` : `<div class="score-placeholder">0</div>`;
      }
      return scoresHTML;
    } else {
      if (!teamInnings || teamInnings.length === 0) return `<div class="score-placeholder">0</div>`;
      const inning = teamInnings[0];
      const score = formatHeaderScore(inning);
      if (!score) return `<div class="score-placeholder">0</div>`;
      const overs = `(${inning.overs} ov)`;
      return `<div>${score}</div><div class="score-overs">${overs}</div>`;
    }
  };

  const generateLogoHTML = (team, logoClass, imgId) => {
    const fallbackText = team.teamSName || "??";
    const onErrorLogic = `applyLogoFallback(this.parentElement, '${fallbackText}')`;

    return `<div class="team-logo ${logoClass}">
              <img id="${imgId}" alt="${team.teamName}" onerror="${onErrorLogic}" />
            </div>`;
  };

  let inningsLabelsContent = '';
  if (isTestMatch) {
    if (hasFirstInnings) inningsLabelsContent += `<div>1st</div>`;
    if (hasSecondInnings) inningsLabelsContent += `<div>2nd</div>`;
  }
  const inningsLabelsHTML = `<div class="inning-labels-column">${inningsLabelsContent}</div>`;
  
  const team1ScoreHTML = generateScoreHTML(team1Innings);
  const team2ScoreHTML = generateScoreHTML(team2Innings);
  
  const team1LogoHTML = generateLogoHTML(meta.team1, "team-logo-1", "team1-logo-img");
  const team2LogoHTML = generateLogoHTML(meta.team2, "team-logo-2", "team2-logo-img");

  container.innerHTML = `
    <div class="match-header-date">${formatMatchDate(meta.matchFormat, meta.startDate, meta.endDate)}</div>
    <div class="match-header-container">
      <div class="match-header-main">
        <div class="team-column">
          ${team1LogoHTML}
          <div class="team-name">${meta.team1.teamName}</div>
        </div>
        <div class="team-scores-column team-scores-left">${team1ScoreHTML}</div>
        ${inningsLabelsHTML}
        <div class="team-scores-column team-scores-right">${team2ScoreHTML}</div>
        <div class="team-column">
          ${team2LogoHTML}
          <div class="team-name">${meta.team2.teamName}</div>
        </div>
      </div>
      <div class="match-header-status">
        <div class="status-result">${meta.status}</div>
        <div class="status-detail">${meta.seriesName} · ${meta.matchDesc}</div>
      </div>
    </div>
  `;

  const team1Img = document.getElementById("team1-logo-img");
  const team2Img = document.getElementById("team2-logo-img");
  
  loadTeamLogo(meta.team1, team1Img);
  loadTeamLogo(meta.team2, team2Img);
}

function renderTabs(n) {
  const t = document.getElementById("innings-tabs");
  const e = document.getElementById("innings-container");
  t.innerHTML = "";
  e.innerHTML = "";
  
  n.forEach((n, o) => {
    const a = document.createElement("button");
    a.className = "tab-button";
    a.textContent = `${n.battingTeam} - Innings ${n.inningNumber}`;
    a.onclick = () => switchInning(o);
    0 === o && a.classList.add("active");
    t.appendChild(a);
    
    const l = document.createElement("div");
    l.className = "inning-content" + (0 === o ? " active" : "");
    l.id = `inning-${o}`;
    l.innerHTML = renderInningHTML(n);
    e.appendChild(l);
  });
}

function switchInning(n) {
  document.querySelectorAll(".tab-button").forEach(n => n.classList.remove("active"));
  document.querySelectorAll(".inning-content").forEach(n => n.classList.remove("active"));
  document.querySelectorAll(".tab-button")[n].classList.add("active");
  document.getElementById(`inning-${n}`).classList.add("active");
}

function renderInningHTML(n) {
  const t = n.batting.map(n => `
    <div class="data-row">
      <div class="player-info">
        <div class="player-avatar">${getInitials(n.name)}</div>
        <div>
          <div class="player-name">${n.name||"Unknown"}</div>
          <div class="dismissal-info">${n.dismissal}</div>
        </div>
      </div>
      <div class="stats-container">
        <div>${n.runs??"-"}</div>
        <div>${n.balls??"-"}</div>
        <div>${n.fours??"-"}</div>
        <div>${n.sixes??"-"}</div>
        <div>${n.strikeRate??"-"}</div>
      </div>
    </div>`).join("");
  
  const e = n.bowling.map(n => `
    <div class="data-row">
      <div class="player-info">
        <div class="player-avatar">${getInitials(n.name)}</div>
        <div>
          <div class="player-name">${n.name||"Unknown"}</div>
        </div>
      </div>
      <div class="stats-container">
        <div>${n.overs??"-"}</div>
        <div>${n.maidens??"-"}</div>
        <div>${n.runs??"-"}</div>
        <div>${n.wickets??"-"}</div>
        <div>${parseFloat(n.economy).toFixed(2)??"-"}</div>
      </div>
    </div>`).join("");
  
  return `
    <div class="batting-card">
      <div class="section-title">Batting</div>
      <div class="scoreboard-section-header">
        <div class="header-player-name">Batsman</div>
        <div class="stats-header-right">
          <div>R</div>
          <div>B</div>
          <div>4s</div>
          <div>6s</div>
          <div>S/R</div>
        </div>
      </div>
      ${t}
      <div class="info-row">
        <div class="info-label">Extras</div>
        <div class="info-value">${n.extras.total} <span>${n.extras.details}</span></div>
      </div>
      <div class="info-row">
        <div class="info-label">Total</div>
        <div class="info-value">${n.totalRuns} <span>(${n.wickets} wkts, ${n.overs} ov)</span></div>
      </div>
      ${n.yetToBat ? `<div class="info-row-stacked">
        <div class="info-label">Yet to bat</div>
        <div class="info-value-stacked">${n.yetToBat}</div>
      </div>` : ""}
      ${n.fallOfWickets ? `<div class="info-row-stacked">
        <div class="info-label">Fall of Wickets</div>
        <div class="info-value-stacked">${n.fallOfWickets}</div>
      </div>` : ""}
    </div>
    <div class="bowling-card">
      <div class="section-title">Bowling</div>
      <div class="scoreboard-section-header">
        <div class="header-player-name">Bowler</div>
        <div class="stats-header-right">
          <div>O</div>
          <div>M</div>
          <div>R</div>
          <div>W</div>
          <div>Econ</div>
        </div>
      </div>
      ${e}
    </div>`;
}