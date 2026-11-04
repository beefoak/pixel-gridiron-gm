# Pixel Gridiron GM

A pixel-art pro football general manager game that runs entirely in the browser.

Take over one of 32 franchises and run it season after season:

- **Simulated football** - every play is simulated, producing full box scores, league leaders and watchable pixel-field replays of your games.
- **Player careers** - ratings grow toward potential, peak, then decline with age. Injuries and illness sideline players, and serious injuries can sap athleticism for good.
- **Draft & scouting** - a new draft class every year. Scouts report in during the season and at the Combine; spend scouting points to see through the fog. Each prospect has a college report of 3-5 traits tied to their real ratings, and every pick is graded on where it went vs. where the player truly ranked, with a full draft review at the end.
- **Depth chart & training** - set your own depth chart any time, and pick players for weekly focus training (empty slots are auto-assigned).
- **Player editor** - edit any player's ratings and bio.
- **Free agency review** - see what you signed, who left and how your team rating moved, with a grade.
- **Trades** - deal players and picks; AI teams value them by talent, age, need, contract and projected draft slot.
- **Salary cap** - a $220M cap that rises each year, contract negotiation, re-signing, free agency waves and dead money.
- **Pro-style season** - 17-game schedules built from the previous year's standings, 7-team conference playoffs and the Megacup.
- **League history** - generated career stats for veterans, a record book, awards, a Hall of Fame and a News feed of storylines.

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
