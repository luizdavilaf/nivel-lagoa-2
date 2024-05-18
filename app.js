const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

async function fetchAndProcessData(url) {
    try {
        console.log('Extraindo dados da URL2:', url	)
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);

        // Extrair dados da tabela
        const headers = [];
        const data = [];
        $('.tabua-mare-home table th').each(function () {
            headers.push($(this).text().trim());
        });
        $('.tabua-mare-home table tbody tr').each(function () {
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
                        const last30Records = existingData.slice(200, existingData.length);
                        console.log(last30Records[last30Records.length - 1])
                        generateChart(last30Records);
                    });
            });
    } catch (error) {
        console.error('Erro ao extrair dados:', error.message);
    }
}

async function generateChart(data) {
    const canvasRenderService = new ChartJSNodeCanvas({ width: 800, height: 400 });

    const config = {
        type: 'line',
        data: {
            labels: data.map(row => row['DD HH:MM']),
            datasets: [{
                label: 'Medição',
                data: data.map(row => row['Medição']),
                fill: false,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day'
                    },
                    title: {
                        display: true,
                        text: 'Data e Hora'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Medição'
                    }
                }
            }
        }
    };

    const image = await canvasRenderService.renderToBuffer(config);
    fs.writeFileSync('grafico.png', image);

    console.log('Gráfico gerado com sucesso!');
}

const url = "https://www.rgpilots.com.br/";
fetchAndProcessData(url);
