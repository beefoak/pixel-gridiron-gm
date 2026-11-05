# Pixel Gridiron GM

A pixel-art pro football general manager game that runs entirely in the browser.

Take over one of 32 franchises and run it season after season:

- **Simulated football** - every play is simulated, producing full box scores, league leaders and watchable pixel-field replays of your games.
- **Player careers** - ratings grow toward potential, peak, then decline with age. Injuries and illness sideline players, and serious injuries can sap athleticism for good.
- **Draft & scouting** - a new draft class every year. Scouts report in during the season and at the Combine; spend scouting points to see through the fog. Each prospect has a college report of 3-5 traits tied to their real ratings, and every pick is graded on where it went vs. where the player truly ranked, with a full draft review at the end.
- **Generational talents** - roughly one draft class in three has an "S" potential prospect who arrives NFL-ready and stays elite for years longer than normal.
- **Team stats** - open any team for its season stat sheet with league ranks and team leaders; a sortable league-wide team stats table lives under Leaders.
- **Depth chart & training** - set your own depth chart any time, and pick players for weekly focus training (empty slots are auto-assigned).
- **Player editor** - edit any player's ratings and bio.
- **Free agency review** - see what you signed, who left and how your team rating moved, with a grade.
- **Trades** - deal players and picks; AI teams value them by talent, age, need, contract and projected draft slot.
- **Salary cap** - a $220M cap that rises each year, contract negotiation, re-signing, free agency waves and dead money.
- **Negotiation tools** - one-click Budget / Team friendly / Player friendly offers with live acceptance odds, staff-simulated negotiations for the players you don't want to handle, a staff cut review, and early restructures for players on bargain deals. Declining veterans are open to 1-year prove-it deals.
- **Pro-style season** - 17-game schedules built from the previous year's standings, 7-team conference playoffs and the Megacup.
- **Draft class strength** - some classes are stacked, some weak, and positions can run deep or thin. On the Scouting tab you can set the overall class and each position to LOW, AVG or HIGH before the season's scouting begins.
- **League history since 1967** - every past season, playoff bracket and Megacup champion is generated, with a full roster and stats for every team. Click any year in a team's history to see who played, or check its all-time franchise leaders.
- **Banners** - team profiles hang pennants for Megacup, conference and division titles.
- **Hall of Fame** - after every Megacup you vote in up to 5 players from a ballot of retirees, and can open each candidate's career stats and highlights first.
- **Records & news** - generated career stats for veterans, a record book, awards and a News feed of storylines.

New to the game? Press **? HOW TO PLAY** on the start screen or the **? HELP** tab in-game for a searchable guide and a "what do I do now?" tip for the current phase.

Found a bug or have an idea? Press **✉ FEEDBACK** (start screen or the header) to send a bug report, suggestion or feedback straight to the developer.

Team names can be customized from the start screen. Games save automatically in your browser (`localStorage`); nothing is sent to a server.

## Play locally

It's a static site with no build step. Serve the folder with any web server, for example:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Hosting on GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, open **Settings > Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, and save.
4. The game will be live at `https://<your-username>.github.io/<repo-name>/` within a minute or two.

When you publish an update, bump the `?v=` number on the script tags in `index.html` so players' browsers load the new code.

## Disclaimer

All teams, players and the league are fictional. This project is not affiliated with or endorsed by any professional sports league.
