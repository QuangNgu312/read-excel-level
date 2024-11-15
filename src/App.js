import React, { useRef, useState } from 'react';
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

  const offsetTopRef = useRef();
  const offsetLeftRef = useRef();
  const offsetRightRef = useRef();

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
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, range: offsetTopRef.current.value * 1 || 0 });
    setSheetData(removeLastTwoColumns(jsonData));
  }

  const handleSheetSelect = (event) => {
    const selectedSheetName = event.target.value;
    setSelectedSheet(selectedSheetName);
    const workbook = XLSX.read(fileData, { type: 'array' });
    loadSheetData(workbook, selectedSheetName);
  };

  const removeLastTwoColumns = (data) => {
    return data.map(row => {
      let dataRow = [...row]; // Clone the row to avoid modifying the original

      // Check and apply offsetLeftRef
      if (offsetLeftRef.current?.value) {
        const offsetLeft = parseInt(offsetLeftRef.current.value, 10);
        dataRow = dataRow.slice(offsetLeft);
      }

      // Check and apply offsetRightRef
      if (offsetRightRef.current?.value) {
        const offsetRight = parseInt(offsetRightRef.current.value, 10);
        dataRow = dataRow.slice(0, dataRow.length - offsetRight);
      }
      return dataRow;
    });
  };

  const suffixes = ["(Lifespan)", "(BulletSpeed)", "(Dmg)", "(CoolDown)", "(NumberSpawnBullet)", "(NumberBullet)", "(ATkRange)", "(Size)", "(RadiousExploded)"];
  const suffixesKey = ["lifespan", "BulletSpeed", "Dmg", "CoolDown", "NumberSpawnBullet", "NumberBullet", "ATkRange", "Size", "RadiousExploded"];
  const defaultNames = ["Perk Id", "Perk name", "Description", "Note", "Effect"];
  const updateHeaderNames = (headers) => {
    const updatedHeaders = [...headers];
    defaultNames.forEach((name, idx) => updatedHeaders[idx] = name);

    for (let i = 5; i < updatedHeaders.length; i++) {
      const groupIndex = Math.floor((i - defaultNames.length) / suffixes.length);
      let indexSuffixes = (i - defaultNames.length) % suffixes.length;
      updatedHeaders[i] = "Level:" + (groupIndex + 1) + "\n" + suffixes[indexSuffixes];
    }

    return updatedHeaders;
  };


  const generateJson = () => {
    // Filter the rows to exclude invalid waves
    let newSheetData = sheetData.filter(item => {
      const wave = item[0];
      // Skip rows where the wave value is invalid (null, "-", or "")
      return wave && wave !== "-" && wave !== "";
    });

    const jsonData = {
      perk: newSheetData.map((row) => {
        const entry = {
          "perkId": row[0],
          'perkName': row[1],
          'description': row[2],
          'note': row[3],
          'effect': row[4],
          perkList: []
        };

        for(let i = 5;i < row.length;i+=suffixes.length){
          const groupIndex = Math.floor((i - defaultNames.length) / suffixes.length);
          const groupStart = defaultNames.length + groupIndex * suffixes.length;
          let groupData = {};
          for (let j = 0; j < suffixesKey.length; j++) {
            const columnIndex = groupStart + j;

            groupData[suffixesKey[j]] = row[columnIndex];

            if(isNaN(row[columnIndex])){
              groupData[suffixesKey[j]] = 0;
            }
          }
          entry.perkList.push({
            [groupIndex]:{...groupData}
          });

        }

        return entry;
      })
    };
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'output.json';
    link.click();
  };





  return (
    <div style={styles.container}>
      <input type="file" onChange={handleFileUpload} accept=".xlsx, .xls" />

      <input style={styles.input_offset} ref={offsetTopRef} placeholder='Off Top' type='number' />
      <input style={styles.input_offset} ref={offsetLeftRef} placeholder='Off Left' type='number' />
      <input style={styles.input_offset} ref={offsetRightRef} placeholder='Off Right' type='number' />

      {sheetNames.length > 0 && (
        <select value={selectedSheet} onChange={handleSheetSelect} style={styles.select}>
          {sheetNames.map((name, index) => (
            <option key={index} value={name}>{name}</option>
          ))}
        </select>
      )}

      {sheetData && (
        <>
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
  button: { marginLeft: "20px", padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '20px', marginRight: '10px' },
  modal: { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'white', padding: '20px', borderRadius: '4px', width: '300px', textAlign: 'center' },
  input: { width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px' },
  headerRow: { backgroundColor: '#4CAF50', color: 'white' },
  input_offset: {
    margin: '0 20px',
    height: '30px',
    width: '90px',
    padding: '10px',
    fontSize: '20px'
  }
};

export default App;
