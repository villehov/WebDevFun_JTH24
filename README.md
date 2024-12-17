# Tid- och Verktygshanteringsapplikation
Detta är mitt slutprojekt inom kursen *Grundläggande Webbutveckling* som jag läste under hösten 2024. 
Projektet är tänkt som en prototyp till en tid- och verktygsloggningsapplikation för företag. Fokus ligger på 
att demonstrera CRUD-operationer, grundläggande säkerhet, samt design och strukturering.

# 🎯 **Projektets syfte**
Syftet med projektet är att bygga en backend-driven webbapplikation som hanterar tid- och verktygsloggning, 
inklusive inloggningssessioner och avancerade databasoperationer.

# 🛠️ **Teknologier som används**
## Backend:
- **Node.js** – JavaScript-miljö för servern.  
- **Express.js** – Backend-ramverk för att hantera HTTP-förfrågningar.  
- **SQLite3** – Lättviktsdatabas för att lagra data.  
- **Express-session** – För att hantera användarsessioner.
## Frontend:
- **HTML/CSS** – Struktur och styling för gränssnittet.  
- **JavaScript** – Interaktivitet på klientsidan.  
- **Handlebars.js** – Template-motor för att strukturera frontend.

## ✨ **Huvudfunktioner**
- **CRUD-operationer**:  
   - **Create** – Lägg till ny tid/verktygslogg, skapa nya användare.  
   - **Read** – Visa befintliga tids-loggar, verktygsloggar samt koppla dessa till dess användare.  
   - **Update** – Redigera användarkonton.  
   - **Delete** – Ta bort verktyg, verktygsloggar, tidsloggar, användare.

- **Session-hantering**:  
   Användarsessioner hanteras säkert med **express-session**.

- **Säkerhet**:  
   - Inmatningsvalidering för att förhindra SQL-injection med hjälp av *prepared statements*.
   - Lösenord skyddas med hashning innan databasslagring ned hjälp av `bcrypt`.
   - Verifiering av inloggnings- och admin- status vid varje sida och handling.
   - Session Cleanup.
   - SessionSecret är just nu hårdkodad, bör ändras till miljövariabel för säkerhet.  
