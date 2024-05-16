const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const plotly = require('plotly')("username", "apiKey");

async function fetchAndProcessData(url) {
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);

        // Extrair dados da tabela
        const headers = [];
        const data = [];
        $('table th').each(function () {
            headers.push($(this).text().trim());
        });
        $('table tbody tr').each(function () {
            const rowData = {};
            $(this).find('td').each(function (i) {
                rowData[headers[i]] = $(this).text().trim();
            });
            data.push(rowData);
        });

        // Processar dados
        const formattedData = data.map(row => ({
            'DD HH:MM': row['DD HH:MM'],
            'Previsão': row['Previsão'],
            'Medição': parseFloat(row['Medição'].replace('-', NaN)) + 1.36
        })).filter(row => !isNaN(row['Medição']));

        // Carregar dados existentes do CSV
        const existingData = [];
        fs.createReadStream('dados.csv')
            .pipe(csv())
            .on('data', (row) => {
                existingData.push(row);
            })
            .on('end', () => {
                // Comparar os dados da URL com os dados existentes no CSV e atualizar se necessário
                formattedData.forEach(newEntry => {
                    const existingEntryIndex = existingData.findIndex(entry => entry['DD HH:MM'] === newEntry['DD HH:MM']);
                    if (existingEntryIndex !== -1) {
                        existingData[existingEntryIndex] = newEntry;
                    } else {
                        existingData.push(newEntry);
                    }
                });

                // Salvar dados atualizados no CSV
                const csvWriter = createCsvWriter({
                    path: 'dados.csv',
                    header: [
                        {id: 'DD HH:MM', title: 'DD HH:MM'},
                        {id: 'Previsão', title: 'Previsão'},
                        {id: 'Medição', title: 'Medição'}
                    ]
                });
                csvWriter.writeRecords(existingData)
                    .then(() => {
                        console.log('Dados atualizados e salvos em dados.csv com sucesso!');

                        // Gerar gráfico com base nos últimos 30 registros
                        const last30Records = existingData.slice(-30);
                        const trace = {
                            x: last30Records.map(row => row['DD HH:MM']),
                            y: last30Records.map(row => row['Medição']),
                            mode: 'lines+markers',
                            type: 'scatter'
                        };
                        const layout = {
                            title: 'Últimos 30 registros de medição',
                            xaxis: {
                                title: 'Data e Hora'
                            },
                            yaxis: {
                                title: 'Medição'
                            }
                        };
                        const graphOptions = { layout: layout, format: 'png' };
                        plotly.getImage(trace, graphOptions, (err, imageStream) => {
                            if (err) throw err;
                            const fileStream = fs.createWriteStream('grafico.png');
                            imageStream.pipe(fileStream);
                            console.log('Gráfico gerado com sucesso!');
                        });
                    });
            });
    } catch (error) {
        console.error('Erro ao extrair dados:', error.message);
    }
}

const url = "https://www.rgpilots.com.br/";
fetchAndProcessData(url);
