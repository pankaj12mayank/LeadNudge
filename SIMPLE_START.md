# Simple start (non-technical)

## Who this guide is for

| You are… | What you do |
|----------|-------------|
| **The seller / operator (B2B)** | You install the software once on a server or PC, keep **admin** login **only with you**, create **workspaces** and **user** accounts for each client. |
| **Your client (their sales team)** | They **do not** install Python or Node. You give them a normal **website link** (your domain) and **email + password** for the **user** portal only. They open the browser, sign in, and use Leads / Follow-ups — no admin screens. |

**Important for B2B:** Admin access stays with you. Clients never receive the admin password and do not need the admin part of the app — only the workspace **user** experience after login.

---

Follow the steps below **only if you are setting up or running the system** (usually you, the vendor). End clients skip straight to “What your client needs” at the bottom.

## What you are installing

1. **Python** — runs the server that stores data and talks to the AI.
2. **Node** — runs the web screens you click in the browser.
3. **Ollama** — runs the AI on your computer (free plan uses this).

## One-time setup

1. **Install Python**  
   Download from the official Python website and install. On Windows, tick the option to add Python to PATH.

2. **Install Node**  
   Download the **LTS** version from the official Node website and install with the default options.

3. **Install Ollama**  
   Download from the Ollama website and install. Open the Ollama app or a terminal once so it can download a language model (the setup guide mentions a command like `ollama pull llama3.2`).

4. **Open the project folder**  
   Unzip or copy the **ai-sales-agent** folder somewhere easy to find, for example your Desktop.

5. **Backend setup (first time only)**  
   - Open **Command Prompt** or **PowerShell**.  
   - Go into the `backend` folder inside the project (use `cd` to change folder).  
   - Run the commands listed in **CLIENT_SETUP.md** under “Backend setup” (create the virtual environment, install requirements, copy `.env.example` to `.env`).  
   - Open the new **`.env`** file with Notepad and set at least the admin email and password at the bottom (`BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`).

6. **Frontend setup (first time only)**  
   - In a terminal, go into the `frontend` folder.  
   - Run `npm install`.  
   - Copy `.env.example` to `.env` if the guide says to.

## Every time you want to run the app

1. Double-click **`start.bat`** in the **ai-sales-agent** folder (the same folder that contains `start.bat`, not inside `backend` or `frontend`).

2. Wait a few seconds. The script starts the server and the web app and tries to open your browser.

3. If the browser does not open, go to: **http://localhost:5173**

4. Sign in with the admin email and password you put in **`backend\.env`**.  
   **Keep this admin account private** if you sell B2B — use it only yourself to manage clients.

## Selling B2B: cheap domain + what you give the client

**Rough plan (lowest cost):**

1. Buy an **inexpensive domain** (e.g. yearly promos on registrars like Namecheap, Porkbun, or Cloudflare — compare prices).
2. Host the app on a **small VPS** (e.g. Hetzner, DigitalOcean, Vultr — entry plans are often enough to start) or split **static website** (frontend) on free/cheap static hosting and **API** on a small paid host — see **README.md** and **CLIENT_SETUP.md** for details.
3. Use **free SSL** (Let’s Encrypt, or Cloudflare in front of your domain).
4. For each paying client: create a **workspace** in admin, add their **users** in **Team**, send them **only** the **public URL** (e.g. `https://yourdomain.com`) and their **user** email/password. They never see admin menus.

## What your client needs (no install)

- A normal web browser.
- The link you send them (your domain).
- The **user** email and password you created in **Team** — **not** the admin login.

## If something does not work

- Read the messages in the black windows that **start.bat** opened (they may be minimized on the taskbar).
- Check **CLIENT_SETUP.md** for more detail and troubleshooting.
- Make sure Python and Node finished installing and that you ran `npm install` in the `frontend` folder once.
