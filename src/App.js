import React, { useState } from 'react';
import * as XLSX from 'xlsx';

function App() {
  return <ExcelReader />;
}

const ExcelReader = () => {
  const [fileData, setFileData] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [sheetData, setSheetData] = useState(null);
  const [columnNames, setColumnNames] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(0);
  const [customName, setCustomName] = useState('');

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        setFileData(data);  // Save file data to state
        const workbook = XLSX.read(data, { type: 'array' });
        setSheetNames(workbook.SheetNames);
        setSelectedSheet(workbook.SheetNames[0]);
        loadSheetData(workbook, workbook.SheetNames[0]);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const loadSheetData = (workbook, sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 2 });
    setSheetData(removeLastTwoColumns(jsonData));
  };

  const handleSheetSelect = (event) => {
    const selectedSheetName = event.target.value;
    setSelectedSheet(selectedSheetName);
    const workbook = XLSX.read(fileData, { type: 'array' });
    loadSheetData(workbook, selectedSheetName);
  };

  const removeLastTwoColumns = (data) => data.map(row => row.slice(0, -2));

  const updateHeaderNames = (headers) => {
    const updatedHeaders = [...headers];
    const defaultNames = ["wave", "start time", "end time", "total wave", "total enemy"];
    defaultNames.forEach((name, idx) => updatedHeaders[idx] = name);

    const groupNames = columnNames;
    const suffixes = ["(Quantity)", "(Scale)", "(Min distance)", "(Max distance)", "(Radius)", "(Type spawn)"];
    for (let i = 5; i < updatedHeaders.length; i++) {
      const groupIndex = Math.floor((i - 5) /6);
      if (groupNames[groupIndex]) updatedHeaders[i] = "id:" + groupNames[groupIndex] + "-" + suffixes[(i -5) % 6];
    }

    return updatedHeaders;
  };

  const handleNameChange = (e) => setCustomName(e.target.value);

  const handleSaveName = () => {
    const updatedNames = [...columnNames];
    updatedNames[currentGroup] = customName;
    setColumnNames(updatedNames);
    setCustomName('');
    setCurrentGroup(currentGroup + 1);

    if (currentGroup + 1 >= Math.ceil(sheetData[0].length / 6)) {
      setShowModal(false);
    }
  };

  const openModal = () => {
    setShowModal(true);
    setCurrentGroup(0);
  };

  const generateJson = () => {
    // Filter the rows to exclude invalid waves
    let newSheetData = sheetData.filter(item => {
        const wave = item[0];
        // Skip rows where the wave value is invalid (null, "-", or "")
        return wave && wave !== "-" && wave !== "";
    });

    const jsonData = {
        waves: newSheetData.map((row) => {
            const entry = {
                wave: row[0],
                'start time': row[1],
                'end time': row[2],
                'total wave': row[3],
                'total enemy': row[4],
                enemylist: []  // Initialize the enemylist
            };

            let previousIndex = -1;
            let previousIndexData = [];

            let excludedValue = ["-", ""];
            let useData = true;

            columnNames.forEach((name, groupIndex) => {
                const groupStart = 5 + groupIndex * 6;
                const groupData = [];

                // Loop through each of the 6 columns for this enemy group
                for (let i = 0; i < 6; i++) {
                    const columnIndex = groupStart + i;
                    groupData[i] = row[columnIndex];

                    // If value is excluded, replace it with 0 and reuse previous data if necessary
                    if (excludedValue.includes(row[columnIndex])) {
                        if (i == 0) {
                            useData = false;
                        }
                        groupData[i] = 0;
                        if (useData && previousIndex !== -1) {
                            groupData[i] = previousIndexData[i];
                        }
                    } else {
                        if (i == 0) {
                            useData = true;
                        }
                    }
                }

                // If the data is valid, add it to the enemylist as an object with name and stats
                if (useData) {
                    previousIndex = groupStart;
                    previousIndexData = [...groupData];  // Store previous data for reuse

                    // Create the enemy object with the proper structure
                    const enemyData = {
                        enemyName: name,  // Name of the enemy (e.g., "a", "normal")
                        stats: groupData.slice(0, 5),
                        spawns: groupData[5]
                    };

                    // Add the enemy data to the enemylist
                    entry.enemylist.push(enemyData);
                }
            });

            return entry;
        })
    };

    // Create the JSON blob and trigger download
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'output.json';
    link.click();
};





  return (
    <div style={styles.container}>
      <input type="file" onChange={handleFileUpload} accept=".xlsx, .xls" />
      
      {sheetNames.length > 0 && (
        <select value={selectedSheet} onChange={handleSheetSelect} style={styles.select}>
          {sheetNames.map((name, index) => (
            <option key={index} value={name}>{name}</option>
          ))}
        </select>
      )}
      
      {sheetData && (
        <>
          <button onClick={openModal} style={styles.button}>Edit Column Names</button>
          <button onClick={generateJson} style={styles.button}>Generate JSON</button>
          <table style={styles.table}>
            <thead>
              <tr style={styles.headerRow}>
                {updateHeaderNames(Object.keys(sheetData[0])).map((header, index) => (
                  index < sheetData[0].length && (
                    <th key={index} style={styles.headerCell}>{header}</th>
                  )
                ))}
              </tr>
            </thead>
            <tbody>
              {sheetData.map((row, index) => (
                <tr key={index} style={index % 2 === 0 ? styles.evenRow : styles.oddRow}>
                  {row.map((cell, i) => (
                    <td key={i} style={styles.cell}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {showModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h3>Enter a name for columns {currentGroup * 5 + 5} - {Math.min((currentGroup + 1) * 5, sheetData[0].length)}</h3>
            <input
              type="text"
              value={customName}
              onChange={handleNameChange}
              style={styles.input}
            />
            <button onClick={handleSaveName} style={styles.button}>Save Name</button>
            <button onClick={() => setShowModal(false)} style={styles.button}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

// Styling object
const styles = {
  container: { padding: '20px', fontFamily: 'Arial, sans-serif' },
  select: { padding: '10px', margin: '10px 0', fontSize: '16px' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '20px' },
  headerCell: { padding: '10px', border: '1px solid #ddd', textAlign: 'left', fontWeight: 'bold' },
  evenRow: { backgroundColor: '#f2f2f2' },
  oddRow: { backgroundColor: '#ffffff' },
  cell: { padding: '10px', border: '1px solid #ddd', textAlign: 'left' },
  button: { padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '20px', marginRight: '10px' },
  modal: { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'white', padding: '20px', borderRadius: '4px', width: '300px', textAlign: 'center' },
  input: { width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px' },
  headerRow: { backgroundColor: '#4CAF50', color: 'white' },
};

export default App;
