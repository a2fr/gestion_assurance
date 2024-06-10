const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let currentDir = '';
let selectedFiles = {};

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle form submission for "Particuliers"
ipcMain.on('submit-particuliers', (event, data) => {
  const nom = data.nom.toUpperCase();
  const prenom = data.prenom.toUpperCase();
  const telephone = data.telephone;
  const mail = data.mail;
  const dir = path.join('C:\\Users\\alanf\\OneDrive\\Bureau\\GED API FEC FD', `${nom} ${prenom}`);
  // const dir = path.join('C:\\Users\\leoor\\Dropbox\\GED\\GED API FEC FD', `${nom} ${prenom}`);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  currentDir = dir;

  // Définir le nom du fichier avec le numéro de téléphone
  const nomFichier = `${telephone}.txt`;
  const cheminFichier = path.join(currentDir, nomFichier); // Créer le chemin complet du fichier
  const nomFichierMail = `${mail}.txt`;
  const cheminFichierMail = path.join(currentDir, nomFichierMail); // Créer le chemin complet du fichier

  // Créer un fichier vide
  fs.writeFile(cheminFichier, '', (err) => {
    if (err) {
      console.error(`Erreur lors de la création du fichier : ${err.message}`);
      return;
    }
    console.log(`Fichier créé avec succès : ${cheminFichier}`);
    event.sender.send('folder-created', 'particuliers');
  });

  fs.writeFile(cheminFichierMail, '', (err) => {
    if (err) {
      console.error(`Erreur lors de la création du fichier : ${err.message}`);
      return;
    }
    console.log(`Fichier créé avec succès : ${cheminFichierMail}`);
    event.sender.send('folder-created', 'particuliers');
  });
});

// Handle form submission for "Pro"
ipcMain.on('submit-pro', (event, data) => {
  const numeroSociete = data.numeroSociete.toUpperCase();
  const dir = path.join('C:\\Users\\alanf\\OneDrive\\Bureau\\GED API FEC FD', `${numeroSociete}`);
  //const dir = path.join('C:\\Users\\leoor\\Dropbox\\GED\\GED API FEC FD', `${numeroSociete}`);
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  }
  currentDir = dir;
  event.sender.send('folder-created', 'pro');
});

// Handle form submission for "Auto"
ipcMain.on('submit-auto', (event, data) => {
  const marque = data.marque.toUpperCase();
  const modele = data.modele.toUpperCase();
  const immatriculation = data.immatriculation.toUpperCase();
  const numeroContrat = data.numeroContrat.toUpperCase();
  const subDir = path.join(currentDir, `${marque} ${modele} ${immatriculation} ${numeroContrat}`);
  if (!fs.existsSync(subDir)){
    fs.mkdirSync(subDir);
  }
  currentDir = subDir;
  event.sender.send('auto-folder-created');
});

// Handle client search
ipcMain.on('search-client', (event, query) => {
  const baseDir = 'C:\\Users\\alanf\\OneDrive\\Bureau\\GED API FEC FD';
  const results = [];
  if (fs.existsSync(baseDir)) {
    const files = fs.readdirSync(baseDir);
    results.push(...files.filter(file => file.toLowerCase().includes(query.toLowerCase())));
  }
  event.sender.send('search-results', results);
});

// Handle client selection
ipcMain.on('select-client', (event, client) => {
  const selectedClient = client.selectedClient.toUpperCase();
  const clientDir = path.join('C:\\Users\\alanf\\OneDrive\\Bureau\\GED API FEC FD', selectedClient);
  if (fs.existsSync(clientDir)) {
    currentDir = clientDir;
    event.sender.send('client-selected', 'recherche_client');
  }
});

// Handle contract search
ipcMain.on('search-contract', (event, query) => {
  const baseDir = 'C:\\Users\\alanf\\OneDrive\\Bureau\\GED API FEC FD';
  const results = [];

  if (fs.existsSync(baseDir)) {
    const clientDirs = fs.readdirSync(baseDir);

    clientDirs.forEach(clientDir => {
      const clientPath = path.join(baseDir, clientDir);

      if (fs.statSync(clientPath).isDirectory()) {
        const contractDirs = fs.readdirSync(clientPath);

        contractDirs.forEach(contractDir => {
          const contractPath = path.join(clientPath, contractDir);
          if (fs.statSync(contractPath).isDirectory()) {
            const parts = contractDir.split(' ');
            const contractNumber = parts[parts.length - 1]; // Extract the last part as the contract number

            if (contractNumber.startsWith(query)) {
              results.push(contractDir);
            }
          }
        });
      }
    });
  }

  event.sender.send('search-results', results);
});

// Traitement de la selection de contrat
ipcMain.on('select-contract', (event, contract) => {

  const baseDir = 'C:\\Users\\alanf\\OneDrive\\Bureau\\GED API FEC FD';
  let contractDir = '';

  if (fs.existsSync(baseDir)) {

    const clientDirs = fs.readdirSync(baseDir);

    for (let clientDir of clientDirs) {
      const clientPath = path.join(baseDir, clientDir);

      if (fs.statSync(clientPath).isDirectory()) {

        const contractDirs = fs.readdirSync(clientPath);

        for (let contractDirName of contractDirs) {
          const contractPath = path.join(clientPath, contractDirName);

          if (fs.statSync(contractPath).isDirectory()) {

            if (contractDirName === contract.selectedContract) {
              contractDir = path.join(clientPath, contractDirName);
              break;
            }
          }
        }
      }

      if (contractDir) break;
    }
  } else {
    console.error('Repertoire de base introuvable :', baseDir);
  }

  if (contractDir) {
    // Obtenir le répertoire parent de contractDir
    //const parentDir = path.dirname(contractDir);
    currentDir = contractDir;
    event.sender.send('contract-selected');
  } else {
    console.error('Repertoire de contrat introuvable pour le contrat selectionne :', contract.selectedContract);
  }
  
});


// Handle form submission for "Documents"
ipcMain.on('submit-documents', (event, files) => {
  console.log('oskour');
  console.log('Fichiers sélectionnés :', files);
  for (const doc in files) {
    const file = files[doc];
    try {
      const filePath = path.join(currentDir, `${doc} - ${file.name}`);
      fs.writeFileSync(filePath, file.data);
      console.log(`Fichier enregistré : ${filePath}`);
    } catch (error) {
      console.error(`Erreur lors de l'enregistrement du fichier ${file.name}:`, error);
    }
  }
  event.sender.send('files-uploaded');
});