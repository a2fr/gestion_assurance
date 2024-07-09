const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');
const { type } = require('os');
const os = require('os');


const homeDir = os.homedir() + '\\OneDrive\\Bureau';
// Variable pour stocker le répertoire de base
let baseDir =  homeDir + '\\GED API FEC FD';
// Variable pour stocker le fichier Excel
let xlsxFile = homeDir + '\\GED.xlsx';
// Variable pour stocker le fichier Excel pour les règlements
let xlsxFileReglement = homeDir + '\\PaiementContrat.xlsx';
// Variable pour stocker l'icône de l'application
let iconPath = './base-de-donnees.png';
// Variable pour stocker le répertoire courant
let currentDir = baseDir;
// Variable pour stocker le répertoire du premier client pour la fusion
let clientDirFusion1 = '';
// Variable pour savoir s'il s'agit d'un règlement ou non
let isReglement = false;
// Variable pour stocker le type de document
let typeContrat = '';
// Variable pour savoir si on vient de index to ajout_doc
let indexToAjoutDoc = false;
// Variable pour stocker le type de la recherche de règlement
let typeRechercheReglement = '';
// Variable pour savoir si le règlement est multiple
let multipleReglement = false;
// Variable pour savoir si le règlement précédent est multiple
let multipleReglementPrecedent = false;
// Variable pour stocker la remarque à dupliquer pour les contrats multiples
let remarqueDupliquee = '';
// Variable pour stocker la date de règlement précédente
let dateReglementPrecedent = '';
// Variable pour stocker le type de paiement global
let typePaiementGlobal = '';
// Variable pour stocker le type de résiliation
let typeResiliation = '';
// Variable pour savoir si une page html est répétée si une erreur de saisie est détectée
let repetition = false;
// Variable pour savoir si une nouvelle fiche client est créée
let nouvelleFicheClient = false;
// Variable pour stocker la mainWindow
let mainWindow;

function getRowCount(xlsxFile, shitName) {

  // Check if file exists
  if (!fs.existsSync(xlsxFile)) {
    throw new Error('File not found');
  }

  // Read the Excel file
  const workbook = xlsx.readFile(xlsxFile);

  const worksheetName = workbook.SheetNames.find(sheetName => sheetName === shitName);

  // Get the worksheet using the provided sheet name
  const worksheet = workbook.Sheets[worksheetName];

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
  mainWindow = new BrowserWindow({
    icon:iconPath,
    width: 1300,
    height: 700,
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
  if (!indexToAjoutDoc) {
    const clientName = path.basename(currentDir);
    const formattedClientName = capitalizeWords(clientName);
    event.sender.send('client-name', formattedClientName);
  }
});

ipcMain.on('request-doc-name', (event) => {
  const docName = path.basename(currentDir);
  event.sender.send('doc-name', docName);
});

// Handle form submission for "Particuliers"
ipcMain.on('submit-particuliers', (event, data) => {
  nouvelleFicheClient = false;
  const nomDir = data.nom.toUpperCase();
  const prenomDir = data.prenom.toUpperCase();
  const dir = path.join(baseDir, `${nomDir} ${prenomDir}`);

  let erreurSaisie = false;

  // Check for special characters, ç, or accent letters
  const specialCharRegex = /[!@#$%^&*(),.?":{}|<>_çéôàèùâîëûöïüñæœÉÔÀÈÙÂÎËÛÖÏÜÑÆŒ]/g;
  if (specialCharRegex.test(nomDir) || specialCharRegex.test(prenomDir)) {
    showCustomAlert('Les accents et les ç ne sont pas autorisés pour le nom et le prénom');
    erreurSaisie = true;
  } else {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      nouvelleFicheClient = true;
    }
    currentDir = dir;

    // Load the existing workbook
    const workbook = xlsx.readFile(xlsxFile);

    // Access the first worksheet
    const worksheetName = workbook.SheetNames.find(sheetName => sheetName === 'Particuliers');
    const worksheet = workbook.Sheets[worksheetName];

    // Store data in variables
    const nom = capitalizeWords(data.nom);
    const prenom = capitalizeWords(data.prenom);
    const telephone = data.telephone;
    const mail = data.mail;
    const birthday = convertDateFormat(data.birthday);
    const city = capitalizeWords(data.city);
    const country = capitalizeWords(data.country);
    const post = data.post;
    const job = data.job;
    // Get current date and time
    var now = new Date();
    var date = now.toLocaleDateString();

    // Check for duplicate entries
    const duplicateFound = Object.values(worksheet).some((row, index) => {
      if (index === 0) return false; // Ignore the header row
      const cellA = worksheet[xlsx.utils.encode_cell({r: index, c: 0})];
      const cellB = worksheet[xlsx.utils.encode_cell({r: index, c: 1})];
      if (cellA && cellA.v && cellB && cellB.v) {
        return cellA.v.toUpperCase() === nom.toUpperCase() && cellB.v.toUpperCase() === prenom.toUpperCase();
      }
      return false;
    });

    if (!duplicateFound) {
      showCustomAlert('Base de données mise à jour avec succès');
      // Numéro de la ligne à mettre à jour dans le fichier Excel
      let rowNumber = getRowCount(xlsxFile, worksheetName);

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

      // Define the column widths (in characters)
      const columnWidths = [
        { wch: 17 }, // Column A
        { wch: 17 }, // Column B
        { wch: 14 }, // Column C
        { wch: 27 }, // Column D
        { wch: 18 }, // Column E
        { wch: 17 }, // Column F
        { wch: 16 }, // Column G
        { wch: 14 }, // Column H
        { wch: 29 },  // Column I
        { wch: 13 }  // Column J
      ];

      // Set the column widths for the worksheet
      worksheet['!cols'] = columnWidths;

      // Save the updated workbook
      xlsx.writeFile(workbook, xlsxFile);
    } else {
      showCustomAlert('Ce client existe déjà dans la base de données');
    }
    erreurSaisie = false;
  }
  event.sender.send('folder-created', 'particuliers', erreurSaisie);
});


// Handle form submission for "Pro"
ipcMain.on('submit-pro', (event, data) => {
  const numeroSociete = data.numeroSociete.toUpperCase();
  const telephone = data.telephone;
  const mail = data.mail;
  const dir = path.join(baseDir, `${numeroSociete}`);
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  }
  currentDir = dir;

  // Load the existing workbook
  const workbook = xlsx.readFile(xlsxFile);

  // Access the first worksheet
  let worksheetName = workbook.SheetNames.find(sheetName => sheetName === 'Professionnels');

  if (!worksheetName) {

    // Create a new worksheet with the date as the name
    const newWorksheet = xlsx.utils.aoa_to_sheet([
      ['Nom de la société', 'Téléphone', 'Mail', "Date d'arrivée"]
    ]);
  
    // Append the new worksheet to the existing workbook
    xlsx.utils.book_append_sheet(workbook, newWorksheet, 'Professionnels');
  
    // Save the updated workbook
    xlsx.writeFile(workbook, xlsxFile);
    worksheetName = workbook.SheetNames.find(sheetName => sheetName === 'Professionnels');
  }

  const worksheet = workbook.Sheets[worksheetName];

  // Store data in variables
  const nom = capitalizeWords(data.numeroSociete);
  // Get current date and time
  var now = new Date();
  var date = now.toLocaleDateString();

  // Check for duplicate entries
  const duplicateFound = Object.values(worksheet).some((row, index) => {
    if (index === 0) return false; // Ignore the header row
    const cellA = worksheet[xlsx.utils.encode_cell({r: index, c: 0})];
    if (cellA && cellA.v) {
      return cellA.v.toUpperCase() === nom.toUpperCase();
    }
    return false;
  });

  if (!duplicateFound) {
    // Numéro de la ligne à mettre à jour dans le fichier Excel
    let rowNumber = getRowCount(xlsxFile, worksheetName);

    // Define the row number and new data for the row (1-based index)
    const newRowData = {
      A: nom,
      B: telephone,
      C: mail,
      D: date
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

    // Define the column widths (in characters)
    const columnWidths = [
      { wch: 21 }, // Column A
      { wch: 17 }, // Column B
      { wch: 27 }, // Column C
      { wch: 13 }  // Column D
    ];

    // Set the column widths for the worksheet
    worksheet['!cols'] = columnWidths;

    // Save the updated workbook
    xlsx.writeFile(workbook, xlsxFile);
  }
  nouvelleFicheClient = true;
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
  if (!fs.existsSync(subDir)) {
    fs.mkdirSync(subDir);
    showCustomAlert('Dossier auto créé avec succès');
  } else {
    showCustomAlert('Ce dossier existe déjà');
  }
  currentDir = subDir;
  event.sender.send('auto-folder-created');
});

// Handle form submission for "Habitation"
ipcMain.on('submit-habitation', (event, data) => {
  typeContrat = data.typeDocument;

  const adresse = data.adresse.toUpperCase() || '';
  const codePostal = data.codePostal.toUpperCase() || '';
  const ville = data.ville.toUpperCase() || '';
  const numeroContrat = data.numeroContrat.toUpperCase() || '';

  const subDirParts = [adresse, codePostal, ville, numeroContrat].filter(Boolean);
  let subDirName = ``;

  if (typeContrat === 'habitation') {
    subDirName = `MRH ${subDirParts.join(' ')}`;
  } else if (typeContrat === 'mrp'){
    subDirName = `MRP ${subDirParts.join(' ')}`;
  }
  const subDir = path.join(currentDir, subDirName);

  if (!fs.existsSync(subDir)) {
    fs.mkdirSync(subDir);
    showCustomAlert('Dossier habitation créé avec succès');
  } else {
    showCustomAlert('Ce dossier existe déjà');
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

ipcMain.on('search-client', (event, query) => {
  const results = [];

  // Check if the base directory exists
  if (fs.existsSync(baseDir)) {
    // Read all the files in the base directory
    const files = fs.readdirSync(baseDir);

    // Iterate over the files
    for (const file of files) {
      const filePath = path.join(baseDir, file);
      const stats = fs.lstatSync(filePath);

      if (stats.isDirectory()) {
        if (file.includes('&')) {
          // If file contains &, search in subfiles
          const subFiles = fs.readdirSync(filePath);
          // Filter the subfiles based on the query
          const filteredSubFiles = subFiles.filter(subFile => subFile.toLowerCase().includes(query.toLowerCase()));
          // Add the filtered subfiles to results
          for (const subFile of filteredSubFiles) {
            const subFilePath = path.join(filePath, subFile);
            const subStats = fs.lstatSync(subFilePath);
            if (subStats.isDirectory()) {
              results.push(subFile);
            }
          }
        } else if (file.toLowerCase().includes(query.toLowerCase())) {
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
  event.sender.send('client-selected', isReglement);
});

// Handle contract search
ipcMain.on('search-contract', (event, query) => {
  const results = [];

  if (isReglement) {
    const contractDirs = fs.readdirSync(currentDir);
    contractDirs.forEach(contractDir => {
      const contractPath = path.join(currentDir, contractDir);
        if (fs.statSync(contractPath).isDirectory()) {
          //const parts = contractDir.split(' ');
          //const contractNumber = parts[parts.length - 1]; // Extract the last part as the contract number
          if (contractDir.includes(query.toUpperCase())) {
            //const contractDirName = contractDir.length > maxLength ? `${contractDir.substring(0, maxLength - 3)}...` : contractDir;
            //results.push(contractDirName);
            results.push(contractDir);
          }
        }
    });
  }
  else {
    const clientDirs = fs.readdirSync(baseDir);
    clientDirs.forEach(clientDir => {
      if (clientDir.includes('&')) {
        const clientSubDirs = fs.readdirSync(path.join(baseDir, clientDir));
        clientSubDirs.forEach(clientSubDir => {
          const clientPath = path.join(baseDir, clientDir, clientSubDir);

          if (fs.statSync(clientPath).isDirectory()) {
            const contractDirs = fs.readdirSync(clientPath);

            contractDirs.forEach(contractDir => {
              //const parts = contractDir.split(' ');
              //const contractNumber = parts[parts.length - 1]; // Extract the last part as the contract number
              if (contractDir.includes(query.toUpperCase())) {
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
              //const parts = contractDir.split(' ');
              //const contractNumber = parts[parts.length - 1]; // Extract the last part as the contract number
              if (contractDir.includes(query.toUpperCase())) {
                //const contractDirName = contractDir.length > maxLength ? `${contractDir.substring(0, maxLength - 3)}...` : contractDir;
                //results.push(contractDirName);
                results.push(contractDir);
              }
            }
          });
        }
      }
    });
  }
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
  console.log('Files:', Object.keys(files).length);
  if (Object.keys(files).length > 0) {
    for (const doc in files) {
      console.log('Doc:', doc);
      const file = files[doc];
      console.log('File:', file);
      try {
        const filePath = path.join(currentDir, `${doc} ${file.name}`);
        fs.writeFileSync(filePath, file.data);
      } catch (error) {
        console.error(`Erreur lors de l'enregistrement du fichier ${file.name}:`, error);
      }
    }
    showCustomAlert('Fichiers téléchargés avec succès');
  }
  typeResiliation = '';
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
    showCustomAlert('Les deux dossiers clients pour la fusion sont identiques');
  } else {
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
      showCustomAlert('Dossiers clients fusionnés avec succès');
    } else {
      showCustomAlert('Dossiers clients introuvables pour la fusion');
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
ipcMain.on('sante-tns-selected', () => {
  productDir = 'SANTE_TNS';
  typeContrat = 'sante_tns';
});

ipcMain.on('sante-selected', () => {
  productDir = 'SANTE';
  typeContrat = 'sante';
});

ipcMain.on('sante-collective-selected', () => {
  productDir = 'SANTE_COLL';
  typeContrat = 'sante_coll';
});

ipcMain.on('prevoyance-tns-selected', () => {
  productDir = 'PREV_TNS';
  typeContrat = 'prev_tns';
});

ipcMain.on('prevoyance-collective-selected', () => {
  productDir = 'PREV_COLL';
  typeContrat = 'prev_coll';
});

ipcMain.on('submit-sante-prev', (event, data) => {

  const numeroContrat = data.numeroContrat.toUpperCase() || '';

  const subDirParts = [numeroContrat].filter(Boolean);
  let subDirName = ``;

  switch (typeContrat) {
    case 'sante_tns':
      subDirName = `SANTE_TNS ${subDirParts.join(' ')}`;
      break;
    case 'sante':
      subDirName = `SANTE ${subDirParts.join(' ')}`;
      break;
    case 'sante_coll':
      subDirName = `SANTE_COLL ${subDirParts.join(' ')}`;
      break;
    case 'prev_tns':
      subDirName = `PREV_TNS ${subDirParts.join(' ')}`;
      break;
    case 'prev_coll':
      subDirName = `PREV_COLL ${subDirParts.join(' ')}`;
      break;
    default:
      // Handle other cases here
      break;
  }
  const subDir = path.join(currentDir, subDirName);

  if (!fs.existsSync(subDir)) {
    switch (typeContrat) {
      case 'sante_tns':
        showCustomAlert('Santé TNS créé avec succès');
        break;
      case 'sante':
        showCustomAlert('Santé créé avec succès');
        break;
      case 'sante_coll':
        showCustomAlert('Santé Collective créé avec succès');
        break;
      case 'prev_tns':
        showCustomAlert('Prévoyance TNS créé avec succès');
        break;
      case 'prev_coll':
        showCustomAlert('Prévoyance Collective créé avec succès');
        break;
    }
    fs.mkdirSync(subDir);
  } else {
    showCustomAlert('Ce dossier existe déjà');
  }

  currentDir = subDir;
  event.sender.send('sante-prev-folder-created', typeContrat);
});

// Handle request for client data
ipcMain.on('request-client-data', (event) => {
  const workbook = xlsx.readFile(xlsxFile);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = [];
  const clientName = path.basename(currentDir);

  let nameArray = clientName.split(" "); // This will create an array: ["Nom", "Prenom"]

  let nom = capitalizeWords(nameArray[0]); // This will give you the first name: "Nom"
  let prenom = capitalizeWords(nameArray[1]); // This will give you the last name: "Prenom"

  // Obtient les limites de la feuille de calcul
  const range = xlsx.utils.decode_range(worksheet['!ref']);

  for (let rowNum = 1; rowNum <= range.e.r + 1; rowNum++) { // range.e.r est en base 0, donc on ajoute 1
    const row = {};
    for (let colNum = 0; colNum <= range.e.c; colNum++) {
      const cellAddress = { c: colNum, r: rowNum };
      const cell = worksheet[xlsx.utils.encode_cell(cellAddress)];
      const columnName = worksheet[xlsx.utils.encode_cell({ c: colNum, r: 0 })].v; // Header row is at r: 0
      row[columnName] = cell ? cell.v : '';
    }
    if (row.Nom && row.Nom.toLowerCase() === nom.toLowerCase() && row.Prénom && row.Prénom.toLowerCase() === prenom.toLowerCase()) {
      rows.push(row);
    }
  }
  console.log('Client Data:', rows);
  event.sender.send('client-data', rows);
});

// Handle form submission for "Reglement Submission"
ipcMain.on('submit-reglement', (event, data) => {
  multipleReglement = data.contratMultiple;
  console.log('Multiple Reglement Précédent:', multipleReglementPrecedent);

  if (!multipleReglementPrecedent) {
    const nomClient = path.basename(path.dirname(currentDir));
    const contractDir = path.basename(currentDir);
    const words = contractDir.split(" ");
    const numeroContrat = words[words.length - 1];

    const beneficiaire = data.beneficiaire.toUpperCase();
    let nomBeneficiaire = '';

    if (beneficiaire === 'CABINET') {
      const cabinet = data.cabinet.toUpperCase();
      const banque = data.banque.toUpperCase();
      nomBeneficiaire = cabinet + ' ' + banque;
    } else if (beneficiaire === 'COMPAGNIE') {
      nomBeneficiaire = data.compagnie.toUpperCase();
    }

    var now = new Date();
    var dateSaisie = now.toLocaleDateString();

    const montant = data.montant;
    const typePaiement = data.typePaiement.toUpperCase();
    let remarques = data.remarques;
    const montantGlobal = data.montantGlobal;
    if (!(montantGlobal === 0 || montantGlobal === '')) {
      if (!(remarques === '' || remarques === undefined || remarques === null)) {
        remarques = data.remarques + ' + Montant Global : ' + montantGlobal;
      } else {
        remarques = 'Montant Global : ' + montantGlobal;
      }
    }
    const dateReglement = convertDateFormat(data.date);
    const sheetName = convertDateToSheetName(dateReglement);

    // Load the existing workbook
    const workbook = xlsx.readFile(xlsxFileReglement);

    // Access the worksheet with the name stored in the date variable
    let worksheetName = workbook.SheetNames.find(shitName => shitName === sheetName);

    if (!worksheetName) {

      // Create a new worksheet with the date as the name
      const newWorksheet = xlsx.utils.aoa_to_sheet([
        ['Nom', 'Type du bénéficiaire', 'Nom du bénéficiaire', 'Date de saisie', 'Date de règlement', 'Montant', 'Numéro de contrat', 'Type de contrat', 'Type de paiement', 'Remarques']
      ]);
    
      // Append the new worksheet to the existing workbook
      xlsx.utils.book_append_sheet(workbook, newWorksheet, sheetName);
    
      // Save the updated workbook
      xlsx.writeFile(workbook, xlsxFileReglement);
      worksheetName = workbook.SheetNames.find(shitName => shitName === sheetName);
    }
    const worksheet = workbook.Sheets[worksheetName];

    // Check for duplicate entries
    const duplicateFound = Object.values(worksheet).some((row, index) => {
      if (index === 0) return false; // Ignore the header row
      const cellG = worksheet[xlsx.utils.encode_cell({r: index, c: 6})];
      if (cellG && cellG.v) {
        return cellG.v.toUpperCase() === numeroContrat.toUpperCase();
      }
      return false;
    });

    if (!duplicateFound) {

      // Numéro de la ligne à mettre à jour dans le fichier Excel
      let rowNumber = getRowCount(xlsxFileReglement, worksheetName);

      // Define the row number and new data for the row (1-based index)
      const newRowData = {
        A: nomClient,
        B: beneficiaire,
        C: nomBeneficiaire,
        D: dateSaisie,
        E: dateReglement,
        F: montant,
        G: numeroContrat,
        H: typeContrat,
        I: typePaiement,
        J: remarques
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

      // Define the column widths (in characters)
      const columnWidths = [
        { wch: 20 }, // Column A
        { wch: 20 }, // Column B
        { wch: 20 }, // Column C
        { wch: 20 }, // Column D
        { wch: 20 }, // Column E
        { wch: 15 }, // Column F
        { wch: 17 }, // Column G
        { wch: 15 }, // Column H
        { wch: 17 }, // Column I
        { wch: 21 }  // Column J
      ];

      // Set the column widths for the worksheet
      worksheet['!cols'] = columnWidths;

      // Save the updated workbook
      xlsx.writeFile(workbook, xlsxFileReglement);

      if (multipleReglement) {
        isReglement = true;
        remarqueDupliquee = remarques;
        dateReglementPrecedent = dateReglement;
        typePaiementGlobal = typePaiement;
      } else {
        isReglement = false;
        showCustomAlert('Règlement enregistré avec succès');
      }
    } else {
      showCustomAlert('Ce contrat a déjà été réglé');
    }
  } else {
    const nomClient = path.basename(path.dirname(currentDir));
    const contractDir = path.basename(currentDir);
    const words = contractDir.split(" ");
    const numeroContrat = words[words.length - 1];

    const beneficiaire = data.beneficiaire.toUpperCase();
    let nomBeneficiaire = '';

    if (beneficiaire === 'CABINET') {
      const cabinet = data.cabinet.toUpperCase();
      const banque = data.banque.toUpperCase();
      nomBeneficiaire = cabinet + ' ' + banque;
    } else if (beneficiaire === 'COMPAGNIE') {
      nomBeneficiaire = data.compagnie.toUpperCase();
    }

    var now = new Date();
    var dateSaisie = now.toLocaleDateString();

    const montant = data.montant;
    const typePaiement = typePaiementGlobal;
    const remarques = remarqueDupliquee;
    const dateReglement = dateReglementPrecedent;
    const sheetName = convertDateToSheetName(dateReglement);

    // Load the existing workbook
    const workbook = xlsx.readFile(xlsxFileReglement);

    // Access the worksheet with the name stored in the date variable
    let worksheetName = workbook.SheetNames.find(shitName => shitName === sheetName);

    if (!worksheetName) {

      // Create a new worksheet with the date as the name
      const newWorksheet = xlsx.utils.aoa_to_sheet([
        ['Nom', 'Type du bénéficiaire', 'Nom du bénéficiaire', 'Date de saisie', 'Date de règlement', 'Montant', 'Numéro de contrat', 'Type de contrat', 'Type de paiement', 'Remarques']
      ]);
    
      // Append the new worksheet to the existing workbook
      xlsx.utils.book_append_sheet(workbook, newWorksheet, sheetName);
    
      // Save the updated workbook
      xlsx.writeFile(workbook, xlsxFileReglement);
      worksheetName = workbook.SheetNames.find(shitName => shitName === sheetName);
    }
    const worksheet = workbook.Sheets[worksheetName];

    // Check for duplicate entries
    const duplicateFound = Object.values(worksheet).some((row, index) => {
      if (index === 0) return false; // Ignore the header row
      const cellG = worksheet[xlsx.utils.encode_cell({r: index, c: 6})];
      if (cellG && cellG.v) {
        return cellG.v.toUpperCase() === numeroContrat.toUpperCase();
      }
      return false;
    });

    if (!duplicateFound) {

      // Numéro de la ligne à mettre à jour dans le fichier Excel
      let rowNumber = getRowCount(xlsxFileReglement, worksheetName);

      // Define the row number and new data for the row (1-based index)
      const newRowData = {
        A: nomClient,
        B: beneficiaire,
        C: nomBeneficiaire,
        D: dateSaisie,
        E: dateReglement,
        F: montant,
        G: numeroContrat,
        H: typeContrat,
        I: typePaiement,
        J: remarques
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

      // Define the column widths (in characters)
      const columnWidths = [
        { wch: 20 }, // Column A
        { wch: 20 }, // Column B
        { wch: 20 }, // Column C
        { wch: 20 }, // Column D
        { wch: 20 }, // Column E
        { wch: 15 }, // Column F
        { wch: 17 }, // Column G
        { wch: 15 }, // Column H
        { wch: 17 }, // Column I
        { wch: 21 }  // Column J
      ];

      // Set the column widths for the worksheet
      worksheet['!cols'] = columnWidths;

      // Save the updated workbook
      xlsx.writeFile(workbook, xlsxFileReglement);

      if (multipleReglement) {
        isReglement = true;
        remarqueDupliquee = remarques;
        dateReglementPrecedent = dateReglement;
      } else {
        showCustomAlert('Règlement enregistré avec succès');
        isReglement = false;
      }
    } else {
      showCustomAlert('Ce contrat a déjà été réglé');
    }
  }

  multipleReglementPrecedent = multipleReglement;
  event.sender.send('reglement-termine');
});

ipcMain.on('type-document-maj', (event, type) => {
  typeContrat = type;
  event.sender.send('type-document-maj-done');
});

ipcMain.on('reglement-in', (event) => {
  isReglement = true;
  event.sender.send('reglement-in-done', isReglement);
});

ipcMain.on('reglement-out', (event) => {
  isReglement = false;
  event.sender.send('reglement-out-done', isReglement);
});

ipcMain.on('get-reglement', (event) => {
  event.sender.send('get-reglement-done', isReglement);
});

ipcMain.on('get-parent-dir', () => {
  currentDir = path.dirname(currentDir);
});

ipcMain.on('index-to-ajout-doc', (event) => {
  indexToAjoutDoc = true;
  event.sender.send('index-to-ajout-doc-done');
});

ipcMain.on('index-out', (event) => {
  indexToAjoutDoc = false;
});

function convertDateToSheetName(date) {
  const parts = date.split("/");

  let mois = parts[1];

  switch (mois) {
    case '01':
      mois = 'Janvier';
      break;
    case '02':
      mois = 'Fevrier';
      break;
    case '03':
      mois = 'Mars';
      break;
    case '04':
      mois = 'Avril';
      break;
    case '05':
      mois = 'Mai';
      break;
    case '06':
      mois = 'Juin';
      break;
    case '07':
      mois = 'Juillet';
      break;
    case '08':
      mois = 'Aout';
      break;
    case '09':
      mois = 'Septembre';
      break;
    case '10':
      mois = 'Octobre';
      break;
    case '11':
      mois = 'Novembre';
      break;
    case '12':
      mois = 'Decembre';
      break;
    default:
      break;
  }

  return mois + " " + parts[2];
}

function convertDateFormat(dateString) {
  if (!dateString) {
    return '';
  }

  // Split the date string into an array of parts
  var parts = dateString.split("-");

  // Rearrange the parts and join them with "/"
  var newDateString = parts[2] + "/" + parts[1] + "/" + parts[0];

  // Return the new date string
  return newDateString;
}

ipcMain.on('search', (event, searchTerm) => {
  const workbook = xlsx.readFile(xlsxFileReglement);
  const sheet_name_list = workbook.SheetNames;

  let searchResults = [];

  // Loop through each sheet
  for (let sheetName of sheet_name_list) {
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Loop through each row in the sheet
    for (let row of sheetData) {
      if (searchTerm === '' || searchTerm === undefined) {
        searchResults.push(row);
      } else {
        switch (typeRechercheReglement) {
          case 'Nom':
            if (row['Nom'] && row['Nom'].toString().toLowerCase().includes(searchTerm.toLowerCase())) {
              searchResults.push(row);
            }
            break;
          case 'Date de saisie':
            if (row['Date de saisie'] && row['Date de saisie'] === searchTerm) {
              searchResults.push(row);
            }
            break;
          case 'Date de règlement':
            if (row['Date de règlement'] && row['Date de règlement'] === searchTerm) {
              searchResults.push(row);
            }
            break;
          case 'Montant':
            if (row['Montant'] && row['Montant'] === searchTerm) {
              searchResults.push(row);
            }
            break;
          case 'Numéro de contrat':
            if (row['Numéro de contrat'] && row['Numéro de contrat'].toString().toLowerCase().startsWith(searchTerm.toLowerCase())) {
              searchResults.push(row);
            }
            break;
          default:
            break;
        }
      }
    }
  }

  event.sender.send('search-reply', searchResults);
});

ipcMain.on('maj-type-recherche-reglement', (event, typeRecherche) => {
  typeRechercheReglement = typeRecherche;
  console.log('Type de recherche reglement mis a jour:', typeRechercheReglement);
  event.sender.send('maj-type-recherche-reglement-done');
});

ipcMain.on('get-multiple-contracts', (event) => {
  event.sender.send('get-multiple-contracts-done', multipleReglement);
});

ipcMain.on('get-multiple-contracts-excel', (event) => {
  event.sender.send('get-multiple-contracts-excel-done', multipleReglement, multipleReglementPrecedent);
});

ipcMain.on('multiple-contracts-out', (event) => {
  multipleReglement = false;
  event.sender.send('multiple-contracts-out-done', multipleReglement);
});

ipcMain.on('searchResiliation', (event, resiliationDatas) => {
  const numeroContrat = resiliationDatas.numeroContrat;
  typeResiliation = resiliationDatas.typeResiliation;

  let contrat = '';
  let clientPathFinal = '';
  let found = false; // Ajoutez cette variable pour suivre si un contrat correspondant a été trouvé

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
            if (contractNumber === numeroContrat) {
              clientPathFinal = clientPath;
              contrat = contractDir;
              found = true; // Définissez found à true lorsqu'un contrat correspondant est trouvé
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
            if (contractNumber === numeroContrat) {
              clientPathFinal = clientPath;
              contrat = contractDir;
              found = true; // Définissez found à true lorsqu'un contrat correspondant est trouvé
            }
          }
        });
      }
    }
  });

  if (found) { // Vérifiez si un contrat correspondant a été trouvé
    currentDir = path.join(clientPathFinal, contrat);
  } else {
    showCustomAlert('Aucun contrat correspondant trouvé');
  }
  event.sender.send('search-results', found);
});


ipcMain.on('request-type-resiliation', (event) => {
  event.sender.send('request-type-resiliation-done', typeResiliation);
});

// Handle client search
ipcMain.on('search-client-only', (event, query) => {
  const results = [];

  // Check if the base directory exists
  if (fs.existsSync(baseDir)) {
    // Read all the files in the base directory
    const files = fs.readdirSync(baseDir);

    // Iterate over the files
    for (const file of files) {
      // Filter the files based on the query
      if (file.toLowerCase().includes(query.toLowerCase())) {
        //const fileName = file.length > maxLength ? `${file.substring(0, maxLength - 3)}...` : file;
        //results.push(fileName);
        results.push(file);
      }
    }
  }

  // Send the search results back to the renderer process
  event.sender.send('search-results', results);
});

ipcMain.on('resiliation-done', () => {
  const parentDir = path.dirname(currentDir);
  const currentDirName = path.basename(currentDir);
  const newDirName = 'RESILIE' + ' ' + currentDirName;
  const newDir = path.join(parentDir, newDirName);

  // Use the fs.rename() method to rename the folder
  fs.rename(currentDir, newDir, (err) => {
    if (err) {
      console.error(err);
      return;
    }
    currentDir = newDir;
  });
  showCustomAlert('Contrat résilié avec succès');
});

ipcMain.on('request-type-recherche-reglement', (event) => {
  event.sender.send('request-type-recherche-reglement-done', typeRechercheReglement);
});

ipcMain.on('request-client-name-produits', (event) => {
  console.log('indextoajoutdoc:', indexToAjoutDoc);
  if (!indexToAjoutDoc) {
    const clientName = path.basename(currentDir);
    const formattedClientName = capitalizeWords(clientName);
    event.sender.send('client-name', formattedClientName, nouvelleFicheClient);
  }
});

ipcMain.on('repetition-produits', (event) => {
  repetition = true;
  event.sender.send('repetition-done');
});

ipcMain.on('repetition-out', (event) => {
  repetition = false;
});

ipcMain.on('repetition-in', (event) => {
  repetition = true;
});

ipcMain.on('get-repetition', (event) => {
  event.sender.send('get-repetition-done', repetition);
});

ipcMain.on('get-nouvelle-fiche-client', (event) => {
  nouvelleFicheClient = true;
  event.sender.send('get-nouvelle-fiche-client-done');
});

ipcMain.on('nouvelle-fiche-client-out', (event) => {
  nouvelleFicheClient = false;
});

ipcMain.on('nouvelle-fiche-client-in', (event) => {
  nouvelleFicheClient = true;
});

ipcMain.on('submit-PNO', (event, data) => {
  const numeroContrat = data.numeroContrat;
  const subDirName = `PNO ${numeroContrat}`;
  const subDir = path.join(currentDir, subDirName);
  if (!fs.existsSync(subDir)){
    fs.mkdirSync(subDir);
  }
  currentDir = subDir;
  showCustomAlert('Dossier PNO créé avec succès !');
  event.sender.send('PNO-folder-created');
});

let customAlert = null

function createCustomAlert() {
  customAlert = new BrowserWindow({
    width: 500,
    height: 200,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  customAlert.loadFile('custom-alert.html')

  customAlert.on('closed', () => {
    customAlert = null
  })
}

function showCustomAlert(message) {
  if (!customAlert) {
    createCustomAlert()
  }

  customAlert.webContents.send('custom-alert', message)
}

ipcMain.on('open-custom-alert', (event, message) => {
  showCustomAlert(message)
})

ipcMain.on('close-custom-alert', () => {
  if (customAlert) {
    customAlert.close()
  }
})

ipcMain.on('request-additional-data', (event) => {
  const rows = [];

  fs.readdir(currentDir, (err, files) => {
    if (err) {
      console.error(err);
      return;
    }

    for (const file of files) {
      const filePath = path.join(currentDir, file);

      if (fs.statSync(filePath).isDirectory()) {
        console.log('Directory:', file);
        rows.push(file);
      }
    }

    console.log('Requesting additional data', rows);
    event.sender.send('additional-data', rows);
  });
});

ipcMain.on('request-doc-type', (event) => {
  console.log('Requesting document type:', typeContrat);
  event.sender.send('request-doc-type-done', typeContrat);
});