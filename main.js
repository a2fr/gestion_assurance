const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');

// Variable pour stocker le répertoire de base
let baseDir = 'C:\\Users\\alanf\\OneDrive\\Bureau\\GED API FEC FD';
// Variable pour stocker le fichier Excel
let xlsxFile = 'C:\\Users\\alanf\\OneDrive\\Bureau\\GED.xlsx';
// Variable pour stocker le répertoire courant
let currentDir = '';
// Variable pour stocker le répertoire du premier client pour la fusion
let clientDirFusion1 = '';
// Nombre maximum de caractères autorisés pour un nom de fichier
const maxLength = 42;

function getRowCount(xlsxFile) {
  // Check if file exists
  if (!fs.existsSync(xlsxFile)) {
    throw new Error('File not found');
  }

  // Read the Excel file
  const workbook = xlsx.readFile(xlsxFile);
  // Get the first sheet name
  const sheetName = workbook.SheetNames[0];
  // Get the first worksheet
  const worksheet = workbook.Sheets[sheetName];

  // Get the range of the worksheet to find the last used row
  const range = xlsx.utils.decode_range(worksheet['!ref']);
  let rowCount = 0;
  for (let row = range.s.r; row <= range.e.r; row++) {
    const cellAddress = xlsx.utils.encode_cell({ r: row, c: 0 }); // Check the first column (A)
    const cell = worksheet[cellAddress];
    if (cell && cell.v) rowCount++;
  }

  // Return the number of rows
  return rowCount + 1;
}

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

ipcMain.on('open-file-manager', () => {
  shell.openPath(currentDir);
});

// Fonction pour transformer correctement les caractères accentués en majuscules
function capitalizeWords(str) {
  return str.toLowerCase().replace(/(?:^|\s)\S/g, (match) => {
    return match.toLocaleUpperCase('fr-FR');
  });
}

ipcMain.on('request-client-name', (event) => {
  const clientName = path.basename(currentDir);
  const formattedClientName = capitalizeWords(clientName);
  event.sender.send('client-name', formattedClientName);
});

ipcMain.on('request-doc-name', (event) => {
  const docName = path.basename(currentDir);
  event.sender.send('doc-name', docName);
});

// Handle form submission for "Particuliers"
ipcMain.on('submit-particuliers', (event, data) => {
  const nomDir = data.nom.toUpperCase();
  const prenomDir = data.prenom.toUpperCase();
  const dir = path.join(baseDir, `${nomDir} ${prenomDir}`);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  currentDir = dir;

  // Load the existing workbook
  const workbook = xlsx.readFile(xlsxFile);

  // Access the first worksheet
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];

  // Store data in variables
  const nom = capitalizeWords(data.nom);
  const prenom = capitalizeWords(data.prenom);
  const telephone = data.telephone;
  const mail = data.mail;
  const birthday = data.birthday;
  const city = capitalizeWords(data.city);
  const country = capitalizeWords(data.country);
  const post = data.post;
  const job = capitalizeWords(data.job);
  const date = data.date;

  // Check for duplicate entries
  const duplicateFound = Object.values(worksheet).some((row, index) => {
    if (index === 0) return false; // Ignore the header row
    const cellA = worksheet[xlsx.utils.encode_cell({r: index, c: 0})];
    const cellB = worksheet[xlsx.utils.encode_cell({r: index, c: 1})];
    const cellC = worksheet[xlsx.utils.encode_cell({r: index, c: 2})];
    if (cellA && cellA.v && cellB && cellB.v && cellC && cellC.v) {
      return cellA.v.toUpperCase() === nom.toUpperCase() && cellB.v.toUpperCase() === prenom.toUpperCase() && cellC.v.toLowerCase() === telephone.toLowerCase();
    }
    return false;
  });

  if (!duplicateFound) {

    // Numéro de la ligne à mettre à jour dans le fichier Excel
    let rowNumber = getRowCount(xlsxFile);
    console.log('Row number:', rowNumber);

    // Define the row number and new data for the row (1-based index)
    const newRowData = {
      A: nom,
      B: prenom,
      C: telephone,
      D: mail,
      E: birthday,
      F: city,
      G: country,
      H: post,
      I: job,
      J: date
    };

    // Update the row data
    Object.keys(newRowData).forEach((column) => {
      const cellAddress = column + rowNumber;
      worksheet[cellAddress] = { t: typeof newRowData[column] === 'number' ? 'n' : 's', v: newRowData[column] };
    });

    // Update the worksheet range
    worksheet['!ref'] = xlsx.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: rowNumber, c: Object.keys(newRowData).length - 1 }
    });

    // Save the updated workbook
    xlsx.writeFile(workbook, xlsxFile);
  }

  event.sender.send('folder-created', 'particuliers');
});

// Handle form submission for "Pro"
ipcMain.on('submit-pro', (event, data) => {
  const numeroSociete = data.numeroSociete.toUpperCase();
  const dir = path.join(baseDir, `${numeroSociete}`);
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  }
  currentDir = dir;
  event.sender.send('folder-created', 'pro');
});

// Handle form submission for "Auto"
ipcMain.on('submit-auto', (event, data) => {
  const marque = data.marque.toUpperCase() || '';
  const modele = data.modele.toUpperCase() || '';
  const immatriculation = data.immatriculation.toUpperCase() || '';
  const numeroContrat = data.numeroContrat.toUpperCase() || '';

  const subDirParts = [marque, modele, immatriculation, numeroContrat].filter(Boolean);
  const subDirName = subDirParts.join(' ');
  const subDir = path.join(currentDir, subDirName);
  if (!fs.existsSync(subDir)){
    fs.mkdirSync(subDir);
  }
  currentDir = subDir;
  event.sender.send('auto-folder-created');
});

// Handle form submission for "Habitation"
ipcMain.on('submit-habitation', (event, data) => {
  const numeroRue = data.numeroRue.toUpperCase() || '';
  const typeRue = data.typeRue.toUpperCase() || '';
  const nomRue = data.nomRue.toUpperCase() || '';
  const codePostal = data.codePostal.toUpperCase() || '';
  const ville = data.ville.toUpperCase() || '';
  const numeroContrat = data.numeroContrat.toUpperCase() || '';

  const subDirParts = [numeroRue, typeRue, nomRue, codePostal, ville, numeroContrat].filter(Boolean);
  const subDirName = `MRH ${subDirParts.join(' ')}`;
  const subDir = path.join(currentDir, subDirName);

  if (!fs.existsSync(subDir)) {
    fs.mkdirSync(subDir);
  }

  currentDir = subDir;
  event.sender.send('habitation-folder-created');
});

// Handle client search fusion
ipcMain.on('search-client-fusion', (event, query) => {
  const results = [];

  const files = fs.readdirSync(baseDir);
  for (const file of files) {
    if (file.toLowerCase().includes(query.toLowerCase())) {
      //const fileName = file.length > maxLength ? `${file.substring(0, maxLength - 3)}...` : file;
      //results.push(fileName);
      results.push(file);
    }
  }
  // Send the search results back to the renderer process
  event.sender.send('search-results', results);
});

// Handle client search fusion2
ipcMain.on('search-client-fusion2', (event, query) => {
  const results = [];

  const files = fs.readdirSync(baseDir);
  for (const file of files) {
    if (file.toLowerCase().includes(query.toLowerCase()) && file !== path.basename(clientDirFusion1)) {
      //const fileName = file.length > maxLength ? `${file.substring(0, maxLength - 3)}...` : file;
      //results.push(fileName);
      results.push(file);
    }
  }
  // Send the search results back to the renderer process
  event.sender.send('search-results', results);
});

// Handle client search
ipcMain.on('search-client', (event, query) => {
  const results = [];

  // Check if the base directory exists
  if (fs.existsSync(baseDir)) {
    // Read all the files in the base directory
    const files = fs.readdirSync(baseDir);

    // Iterate over the files
    for (const file of files) {
      if (file.includes('&')) {
        // If file contains &, search in subfiles
        const subFiles = fs.readdirSync(path.join(baseDir, file));
        // Filter the subfiles based on the query
        const filteredSubFiles = subFiles.filter(subFile => subFile.toLowerCase().includes(query.toLowerCase()));
        // Add the filtered subfiles to results
        for (const subFile of filteredSubFiles) {
          //const fileName = subFile.length > maxLength ? `${subFile.substring(0, maxLength - 3)}...` : subFile;
          //results.push(fileName);
          results.push(subFile);
        }
      } else {
        // Filter the files based on the query
        if (file.toLowerCase().includes(query.toLowerCase())) {
          //const fileName = file.length > maxLength ? `${file.substring(0, maxLength - 3)}...` : file;
          //results.push(fileName);
          results.push(file);
        }
      }
    }
  }

  // Send the search results back to the renderer process
  event.sender.send('search-results', results);
});

// Handle client selection fusion
ipcMain.on('select-client-fusion', (event, client) => {
  const selectedClient = client.selectedClient.toUpperCase();
  const clientDir = path.join(baseDir, selectedClient);

  console.log('Client directory:', clientDir);
  console.log('Selected client:', selectedClient);

  // Check if the client directory exists
  if (fs.existsSync(clientDir)) {
    // Store the selected client directory in local storage for fusion
    clientDirFusion1 = clientDir;
    currentDir = clientDir;
    // Send a message to the renderer process indicating that the client has been selected
    event.sender.send('client-selected');
  }
});

// Handle client selection
ipcMain.on('select-client', (event, client) => {
  let selectedClient = client.selectedClient.toUpperCase();

  if (selectedClient.includes('...')) {
    // Remove the ellipsis from the selected client
    selectedClient = selectedClient.substring(0, selectedClient.length - 3);
    console.log('Selected client1:', selectedClient);
    for (const directory of fs.readdirSync(baseDir)) {
      if (directory.includes(selectedClient)) {
        selectedClient = directory;
        break;
      }
    }
  }

  let clientDir = path.join(baseDir, selectedClient);

  if(!fs.existsSync(clientDir)) {
    for (const directory of fs.readdirSync(baseDir)) {
      if (directory.includes(selectedClient)) {
        if (directory.includes('&')) {
          clientDir = path.join(baseDir, directory);
          clientDir = path.join(clientDir, selectedClient);
          break;
        }
        break;
      }
    }
  }
  // Set the current directory to the client directory
  currentDir = clientDir;
  // Send a message to the renderer process indicating that the client has been selected
  event.sender.send('client-selected');
});

// Handle contract search
ipcMain.on('search-contract', (event, query) => {
  const results = [];
  const clientDirs = fs.readdirSync(baseDir);

  clientDirs.forEach(clientDir => {
    if (clientDir.includes('&')) {
      const clientSubDirs = fs.readdirSync(path.join(baseDir, clientDir));
      clientSubDirs.forEach(clientSubDir => {
        const clientPath = path.join(baseDir, clientDir, clientSubDir);

        if (fs.statSync(clientPath).isDirectory()) {
          const contractDirs = fs.readdirSync(clientPath);

          contractDirs.forEach(contractDir => {
            const parts = contractDir.split(' ');
            const contractNumber = parts[parts.length - 1]; // Extract the last part as the contract number
            if (contractNumber.startsWith(query)) {
              //const contractDirName = contractDir.length > maxLength ? `${contractDir.substring(0, maxLength - 3)}...` : contractDir;
              //results.push(contractDirName);
              results.push(contractDir);
            }
          });
        }
      });
    } else {
      const clientPath = path.join(baseDir, clientDir);

      if (fs.statSync(clientPath).isDirectory()) {
        const contractDirs = fs.readdirSync(clientPath);

        contractDirs.forEach(contractDir => {
          const contractPath = path.join(clientPath, contractDir);
          if (fs.statSync(contractPath).isDirectory()) {
            const parts = contractDir.split(' ');
            const contractNumber = parts[parts.length - 1]; // Extract the last part as the contract number
            if (contractNumber.startsWith(query)) {
              //const contractDirName = contractDir.length > maxLength ? `${contractDir.substring(0, maxLength - 3)}...` : contractDir;
              //results.push(contractDirName);
              results.push(contractDir);
            }
          }
        });
      }
    }
  });
  event.sender.send('search-results', results);
});

// Traitement de la selection de contrat
ipcMain.on('select-contract', (event, contract) => {
  let contractDir = '';

  const clientDirs = fs.readdirSync(baseDir);

  for (let clientDir of clientDirs) {
    if (clientDir.includes('&')) {
      const clientSubDirs = fs.readdirSync(path.join(baseDir, clientDir));
      for (let clientSubDir of clientSubDirs) {
        const clientPath = path.join(baseDir, clientDir, clientSubDir);

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
  }

  if (contractDir) {
    // Obtenir le répertoire parent de contractDir
    currentDir = contractDir;
    event.sender.send('contract-selected');
  } else {
    console.error('Repertoire de contrat introuvable pour le contrat selectionne :', contract.selectedContract);
  }

});


// Handle form submission for "Documents"
ipcMain.on('submit-documents', (event, files) => {
  for (const doc in files) {
    const file = files[doc];
    try {
      const filePath = path.join(currentDir, `${doc} - ${file.name}`);
      fs.writeFileSync(filePath, file.data);
    } catch (error) {
      console.error(`Erreur lors de l'enregistrement du fichier ${file.name}:`, error);
    }
  }
  event.sender.send('files-uploaded');
});

// Fonction pour fusionner deux dossiers
function mergeDirectories(srcDir1, srcDir2, destDir) {

  // Créer le dossier de destination s'il n'existe pas
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir);
  }

  const nameSrcDir1 = path.basename(srcDir1);
  const nameSrcDir2 = path.basename(srcDir2);

  const destDir1 = path.join(destDir, nameSrcDir1);
  const destDir2 = path.join(destDir, nameSrcDir2);

  // Copier les fichiers et dossiers du premier dossier source vers le dossier de destination
  copy(srcDir1, destDir1);

  // Copier les fichiers et dossiers du deuxième dossier source vers le dossier de destination
  copy(srcDir2, destDir2);

  // Supprimer les dossiers sources
  fs.rmdirSync(srcDir1, { recursive: true });
  fs.rmdirSync(srcDir2, { recursive: true });
}

// Fonction pour copier un fichier ou un dossier
function copy(src, dest) {
  // Vérifier si le fichier source est un dossier
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    // Créer le dossier de destination s'il n'existe pas
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    for (const item of fs.readdirSync(src)) {
      copy(path.join(src, item), path.join(dest, item));
    }
  } else {
    // Copier le fichier source vers le fichier de destination
    fs.copyFileSync(src, dest);
  }
}

// Handle form submission for "Fusion"
ipcMain.on('submit-fusion', (event, client) => {
  const clientDirFusion2 = client.selectedClient.toUpperCase();
  const clientDir = path.join(baseDir, clientDirFusion2);

  if (clientDirFusion1 === clientDir) {
    console.error('Les deux dossiers clients pour la fusion sont identiques :', clientDirFusion1, clientDir);
  }
  else {
    // Vérifier si les deux dossiers clients existent
    if (fs.existsSync(clientDirFusion1) && fs.existsSync(clientDir)) {

      const firstClientDir = [clientDirFusion1, clientDir].sort()[0];
      const secondClientDir = [clientDirFusion1, clientDir].sort()[1];

      // Créer un dossier de fusion
      const fusionDir = path.join(`${firstClientDir} & ${path.basename(secondClientDir)}`);
      currentDir = fusionDir;

      // Fusionner les deux dossiers clients
      mergeDirectories(firstClientDir, secondClientDir, fusionDir);

      // Itérer sur tous les dossiers du dossier de fusion
      fs.readdirSync(fusionDir).forEach(item => {
        // Si un nom de dossier contient un &, il faut lui appliquer la fonction unmergeDirectory
        if (item.includes('&')) {
          const dir = path.join(fusionDir, item);
          unmergeDirectory(dir);
        }
      });
    }
    else {
      console.error('Dossiers clients introuvables pour la fusion :', clientDirFusion1, clientDir);
    }
  }
  // Envoyer un message de succès à la fenêtre principale
  event.sender.send('folders-merged');
});

function unmergeDirectory(dir) {
  // Check if the directory exists
  if (fs.existsSync(dir)) {
    // Get the list of subdirectories in the directory
    const subdirectories = fs.readdirSync(dir);
    // Copier tous les sous-dossiers de dir dans le dossier parent de dir
    for (const subdirectory of subdirectories) {
      const subDir = path.join(dir, subdirectory);
      // Vérifier si le sous-dossier est un dossier
      if (fs.statSync(subDir).isDirectory()) {
        // Copier le sous-dossier dans le dossier parent de dir
        fs.renameSync(subDir, path.join(dir, '..', subdirectory));
      }
    }
  }
  // Supprimer le dossier dir
  fs.rmdirSync(dir);
}