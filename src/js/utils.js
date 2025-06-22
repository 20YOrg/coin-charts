import * as XLSX from 'xlsx';

export const gk_isXlsx = false;
export const gk_xlsxFileLookup = {};
export const gk_fileData = {};

export function filledCell(cell) {
    return cell !== '' && cell != null;
}

export function loadFileData(filename) {
    if (gk_isXlsx && gk_xlsxFileLookup[filename]) {
        try {
            const workbook = XLSX.read(gk_fileData[filename], { type: 'base64' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false, defval: '' });
            const filteredData = jsonData.filter(row => row.some(filledCell));
            let headerRowIndex = filteredData.findIndex((row, index) =>
                row.filter(filledCell).length >= filteredData[index + 1]?.filter(filledCell).length
            );
            if (headerRowIndex === -1 || headerRowIndex > 25) {
                headerRowIndex = 0;
            }
            const csv = XLSX.utils.aoa_to_sheet(filteredData.slice(headerRowIndex));
            return XLSX.utils.sheet_to_csv(csv, { header: 1 });
        } catch (e) {
            console.error(e);
            return "";
        }
    }
    return gk_fileData[filename] || "";
}