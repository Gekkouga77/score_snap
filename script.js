let matchesGrid, loadingState, errorState, noMatchesState;

document.addEventListener("DOMContentLoaded", function () {
  matchesGrid = document.getElementById("matchesGrid");
  loadingState = document.getElementById("loadingState");
  errorState = document.getElementById("errorState");
  noMatchesState = document.getElementById("noMatchesState");

  loadMatches();
});

function retryAgain() {
  location.reload();
}

function formatScore(teamScore, matchFormat) {
    if (!teamScore) return "";

    const inngs1 = teamScore.inngs1;
    if (!inngs1) return "";

    let scoreStr;
    if (inngs1.wickets === 10) {
        scoreStr = `${inngs1.runs ?? "0"}`;
    } 
    else {
        scoreStr = `${inngs1.runs ?? "0"}/${inngs1.wickets ?? "0"}`;
    }

    if (matchFormat !== "TEST" && inngs1.overs !== undefined) {
        scoreStr += ` (${inngs1.overs})`;
    }
    
    const inngs2 = teamScore.inngs2;
    if (matchFormat === "TEST" && inngs2 && inngs2.runs !== undefined) {
        let inngs2Score;
        if (inngs2.wickets === 10) {
            inngs2Score = `${inngs2.runs ?? "0"}`;
        } else {
            inngs2Score = `${inngs2.runs ?? "0"}/${inngs2.wickets ?? 0}`;
        }
        scoreStr += ` & ${inngs2Score}`;
    }
    return scoreStr;
}

function createFallbackLogo(imgElement, teamSName) {
  const parent = imgElement.parentElement;
  if (!parent) return;

  const fallbackText = teamSName || '??';

  const textSpan = document.createElement('span');
  textSpan.textContent = fallbackText;
  textSpan.style.display = 'inline-block';

  if (fallbackText.length > 3) {
    const scale = Math.max(0.45, 2.8 / fallbackText.length);
    textSpan.style.transform = `scale(${scale})`;
  }
  parent.replaceChild(textSpan, imgElement);
}

async function loadTeamLogo(team, imgElementId) {
  const imgElement = document.getElementById(imgElementId);
  if (!imgElement) return;

  const teamSName = team?.teamSName || '??';

  if (!team?.imageId) {
    createFallbackLogo(imgElement, teamSName);
    return;
  }

  const url = `https://cricbuzz-cricket.p.rapidapi.com/img/v1/i1/c${team.imageId}/i.jpg`;
  const options = {
    method: 'GET',
    headers: {
      'x-rapidapi-key': 'ade6db22c2msh5675acc6a0a4be5p19773djsne8eab3f14f00',
      'x-rapidapi-host': 'cricbuzz-cricket.p.rapidapi.com'
    }
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    const blob = await response.blob();
    imgElement.src = URL.createObjectURL(blob);
  } catch (error) {
    console.error(`Failed to load logo for ${team.teamName}:`, error.message);
    createFallbackLogo(imgElement, teamSName);
  }
}

function loadMatches() {
    showLoadingState();
    fetch("https://cricbuzz-cricket.p.rapidapi.com/matches/v1/live", {
        method: "GET",
        headers: {
          "x-rapidapi-key": "ade6db22c2msh5675acc6a0a4be5p19773djsne8eab3f14f00",
          "x-rapidapi-host": "cricbuzz-cricket.p.rapidapi.com"
        }
    }).then(res => {
        if (!res.ok) { throw new Error(`HTTP error! status: ${res.status}`); }
        return res.json();
    }).then(data => {
        const cleanedMatches = (data.typeMatches || []).flatMap(typeMatch => {
            const seriesMatches = typeMatch.seriesMatches || [];
            return seriesMatches.flatMap(seriesMatch => {
                if (!seriesMatch?.seriesAdWrapper?.matches) return [];
                return seriesMatch.seriesAdWrapper.matches.map(match => {
                    const info = match?.matchInfo ?? {};
                    const score = match?.matchScore ?? {};
                    const team1 = info.team1 ?? {};
                    const team2 = info.team2 ?? {};
                    
                    let topRightText = "";
                    let statusClass = "";

                    if (info.state && (info.state.toLowerCase() === "in progress" || info.state.toLowerCase() === "innings break")) {
                        topRightText = "LIVE";
                        statusClass = "status-live"; 
                    } 
                    const bottomStatusText = info.status || "";

                    let description = info.seriesName || "";
                    if (description && info.matchDesc) {
                        description += ` • ${info.matchDesc}`;} 
                    else if (info.matchDesc) {
                        description = info.matchDesc;}
                    
                    return {
                        id: info.matchId,
                        description: description,
                        status: bottomStatusText,
                        topRightText: topRightText,
                        topRightStatusClass: statusClass,
                        matchFormat: info.matchFormat || "T20",
                        team1: team1,
                        team1Score: formatScore(score.team1Score, info.matchFormat),
                        team2: team2,
                        team2Score: formatScore(score.team2Score, info.matchFormat),
                    };
                });
            });
        });
      displayMatches(cleanedMatches);
    })
    .catch(error => {
        console.error("Error (in fetching/processing the live match data):", error);
        loadingState.style.display = "none";
        errorState.style.display = "block";
    });
}

function showLoadingState() {
  loadingState.style.display = "grid";
  matchesGrid.style.display = "none";
  errorState.style.display = "none";
  noMatchesState.style.display = "none";
}

function displayMatches(matches) {
    loadingState.style.display = "none";
    errorState.style.display = "none";
    noMatchesState.style.display = "none";

    if (!matches || matches.length === 0) {
        noMatchesState.style.display = "block";
        return;
    }

    matchesGrid.style.display = "grid";
    matchesGrid.innerHTML = "";

    matches.forEach(match => {
        const card = document.createElement("a");
        card.className = "match-card";
        if (match.id) {
            card.href = `match-detail.html?matchId=${match.id}`;
        }

        const team1SName = match.team1.teamSName || 'T1';
        const team2SName = match.team2.teamSName || 'T2';

        card.innerHTML = `
          <div class="card-meta-info">
            <span>${match.description}</span>
            <span class="card-status ${match.topRightStatusClass}">${match.topRightText}</span> 
          </div>
          <div class="card-main-content">
            <div class="card-team-row">
              <div class="card-team-details">
                <div class="team-logo team-logo-1">
                  <img id="t1-logo-${match.id}" alt="${match.team1.teamName}" onerror="createFallbackLogo(this, '${team1SName}')" />
                </div>
                <span>${match.team1.teamName}</span>
              </div>
              <div class="card-team-score">${match.team1Score}</div>
            </div>
            <div class="card-team-row">
              <div class="card-team-details">
                <div class="team-logo team-logo-2">
                  <img id="t2-logo-${match.id}" alt="${match.team2.teamName}" onerror="createFallbackLogo(this, '${team2SName}')" />
                </div>
                <span>${match.team2.teamName}</span>
              </div>
              <div class="card-team-score">${match.team2Score}</div>
            </div>
          </div>
          <div class="card-match-status">
            ${match.status}
          </div>
        `;
        matchesGrid.appendChild(card);

        loadTeamLogo(match.team1, `t1-logo-${match.id}`);
        loadTeamLogo(match.team2, `t2-logo-${match.id}`);
    });
}