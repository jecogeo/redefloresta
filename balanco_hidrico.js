/*
Script escrito por Jefferson Ferreira-Ferreira (ferreira.ferreira@usp.br).
Baseado no capítulo 44 do livro Cardille et al. 2024, Cloud-Based Remote Sensing 
with Google Earth Engine.

Poortinga, Ate, Quyen Nguyen, Nyein Soe Thwal, and Andréa Puzzi Nicolau. “Water 
Balance and Drought.” In Cloud-Based Remote Sensing with Google Earth Engine, 
edited by Jeffrey A. Cardille, Morgan A. Crowley, David Saah, and Nicholas E. Clinton. 
Springer International Publishing, 2024. https://doi.org/10.1007/978-3-031-26588-4_44.
*/


/////////
// Definições iniciais
/////////

// Importar limites do estado de são paulo
var sp = ee.FeatureCollection('FAO/GAUL/2015/level1')
  .filterMetadata('ADM1_NAME', 'equals', 'Sao Paulo');

// Centrar o mapa
Map.centerObject(sp, 6);

// adicionar limites estaduais ao mapa
Map.addLayer(sp, {color: 'FF0000'}, 'SP Boundary');

// Definir anos inicial e final
var startYear = 2014;
var endYear = 2024;

// Criar dois objetos de data para os anos inicial e final
var startDate = ee.Date.fromYMD(startYear, 1, 1);
var endDate = ee.Date.fromYMD(endYear + 1, 1, 1);

// Fazer uma lista de anos com a sequência entre inicio e fim
var years = ee.List.sequence(startYear, endYear);

/////////
// Importar dados
/////////

// Importar dados de precipitação do CHIRPS
var CHIRPS = ee.ImageCollection('UCSB-CHG/CHIRPS/PENTAD')
  .filterDate(startDate, endDate);

// Importar dados de evapotranspiração do MODIS (MOD16)
var mod16 = ee.ImageCollection('MODIS/061/MOD16A2GF')
  .select('ET')
  .filterDate(startDate, endDate);

// Importar dados do MODIS Terra para o cálculo do índice de stress hídrico (MSI-moisture stress index) 
var mod09 = ee.ImageCollection('MODIS/061/MOD09A1')
  .filterDate(startDate, endDate);

/////////
// Pré-processamento
/////////

// Remover núvens e sombras de núvens do MOD09
mod09 = mod09.map(function(image) {
  var quality = image.select('StateQA');
  var mask = image.and(quality.bitwiseAnd(1).eq(0)) // No clouds
    .and(quality.bitwiseAnd(2).eq(0)); // No cloud shadow
  return image.updateMask(mask);
});

// Calcular MSI
var MSI = mod09.map(function(image) {
  var nirband = image.select('sur_refl_b02'); // NIR band
  var swirband = image.select('sur_refl_b06'); // SWIR band
  var msi = swirband.divide(nirband).rename('MSI')
    .set('system:time_start', image.get('system:time_start'));
  return msi;
});

/////////
// 1. Precipitação Média Anual 2014-2024
/////////

var annualPrecip = ee.ImageCollection.fromImages(
  years.map(function(y) {
    var start = ee.Date.fromYMD(y, 1, 1);
    var end = ee.Date.fromYMD(y, 12, 31);
    
    var annualP = CHIRPS
      .filterDate(start, end)
      .sum()
      .rename('precipitation');
      
    return annualP
      .set('year', y)
      .set('system:time_start', start);
  })
);

var meanAnnualPrecip = annualPrecip.mean().rename('mean_annual_precip');

// Visualização
var precipAnnualVis = {
  min: 800,
  max: 1800,
  palette: ['white', 'blue', 'darkblue', 'purple']
};

Map.addLayer(meanAnnualPrecip.clip(sp), precipAnnualVis, 
  '1. Precipitação Média Anual 2014-2024');

/////////
// 2. Evapotranspiração Média Anual 2014-2024
/////////

var annualEvap = ee.ImageCollection.fromImages(
  years.map(function(y) {
    var start = ee.Date.fromYMD(y, 1, 1);
    var end = ee.Date.fromYMD(y, 12, 31);
    
    var annualET = mod16
      .filterDate(start, end)
      .sum()
      .multiply(0.1) // Scaling factor
      .rename('ET');
      
    return annualET
      .set('year', y)
      .set('system:time_start', start);
  })
);

var meanAnnualEvap = annualEvap.mean().rename('mean_annual_et');

// Visualização
var evapAnnualVis = {
  min: 600,
  max: 1200,
  palette: ['darkblue', 'blue', 'yellow', 'orange', 'red']
};

Map.addLayer(meanAnnualEvap.clip(sp), evapAnnualVis, 
  '2. Evapotranspiração Média Anual 2014-2024');

/////////
// 3. Balanço Hídrico Médio Anual 2014-2024
/////////

var annualWaterBalance = ee.ImageCollection.fromImages(
  years.map(function(y) {
    var start = ee.Date.fromYMD(y, 1, 1);
    var end = ee.Date.fromYMD(y, 12, 31);
    
    var annualP = CHIRPS
      .filterDate(start, end)
      .sum();
    
    var annualET = mod16
      .filterDate(start, end)
      .sum()
      .multiply(0.1);
    
    var annualWB = annualP.subtract(annualET).rename('water_balance');
    
    return annualWB
      .set('year', y)
      .set('system:time_start', start);
  })
);

var meanAnnualWaterBalance = annualWaterBalance.mean().rename('mean_annual_wb');

// Visualização
var wbAnnualVis = {
  min: -200,
  max: 800,
  palette: ['red', 'orange', 'yellow', 'lightblue', 'blue', 'darkblue']
};

Map.addLayer(meanAnnualWaterBalance.clip(sp), wbAnnualVis, 
  '3. Balanço Hídrico Médio Anual 2014-2024');

/////////
// 4. MSI Médio Anual 2014-2024
/////////

var annualMSI = ee.ImageCollection.fromImages(
  years.map(function(y) {
    var start = ee.Date.fromYMD(y, 1, 1);
    var end = ee.Date.fromYMD(y, 12, 31);
    
    var annualMSI = MSI
      .filterDate(start, end)
      .mean()
      .rename('MSI');
      
    return annualMSI
      .set('year', y)
      .set('system:time_start', start);
  })
);

var meanAnnualMSI = annualMSI.mean().rename('mean_annual_msi');

// Visualização
var msiAnnualVis = {
  min: 0.1,
  max: 0.8,
  palette: ['darkblue', 'blue', 'cyan', 'yellow', 'orange', 'red']
};

Map.addLayer(meanAnnualMSI.clip(sp), msiAnnualVis, 
  '4. MSI Médio Anual 2014-2024');

/////////
// Gráficos de Série Temporal Anual
/////////

// Gráfico da Precipitação Anual
var precipChart = ui.Chart.image.series({
  imageCollection: annualPrecip,
  region: sp,
  reducer: ee.Reducer.mean(),
  scale: 5000,
  xProperty: 'system:time_start'
}).setOptions({
  title: 'Precipitação Anual (2014-2024)',
  hAxis: {title: 'Ano'},
  vAxis: {title: 'Precipitação (mm)'},
  lineWidth: 2,
  colors: ['blue']
});

print(precipChart);

// Gráfico da Evapotranspiração Anual
var evapChart = ui.Chart.image.series({
  imageCollection: annualEvap,
  region: sp,
  reducer: ee.Reducer.mean(),
  scale: 500,
  xProperty: 'system:time_start'
}).setOptions({
  title: 'Evapotranspiração Anual (2014-2024)',
  hAxis: {title: 'Ano'},
  vAxis: {title: 'Evapotranspiração (mm)'},
  lineWidth: 2,
  colors: ['red']
});

print(evapChart);

// Gráfico do Balanço Hídrico Anual
var wbChart = ui.Chart.image.series({
  imageCollection: annualWaterBalance,
  region: sp,
  reducer: ee.Reducer.mean(),
  scale: 5000,
  xProperty: 'system:time_start'
}).setOptions({
  title: 'Balanço Hídrico Anual (2014-2024)',
  hAxis: {title: 'Ano'},
  vAxis: {title: 'Balanço Hídrico (mm)'},
  lineWidth: 2,
  colors: ['green']
});

print(wbChart);

// Gráfico do MSI Anual
var msiChart = ui.Chart.image.series({
  imageCollection: annualMSI,
  region: sp,
  reducer: ee.Reducer.mean(),
  scale: 500,
  xProperty: 'system:time_start'
}).setOptions({
  title: 'MSI Anual (2014-2024)',
  hAxis: {title: 'Ano'},
  vAxis: {title: 'Moisture Stress Index'},
  lineWidth: 2,
  colors: ['brown']
});

print(msiChart);

/////////
// Estatísticas Resumidas
/////////

// Calcular estatísticas para cada variável
var statsPrecip = meanAnnualPrecip.reduceRegion({
  reducer: ee.Reducer.mean().combine({
    reducer2: ee.Reducer.stdDev(),
    sharedInputs: true
  }),
  geometry: sp.geometry(),
  scale: 5000,
  maxPixels: 1e9
});

var statsEvap = meanAnnualEvap.reduceRegion({
  reducer: ee.Reducer.mean().combine({
    reducer2: ee.Reducer.stdDev(),
    sharedInputs: true
  }),
  geometry: sp.geometry(),
  scale: 500,
  maxPixels: 1e9
});

var statsWB = meanAnnualWaterBalance.reduceRegion({
  reducer: ee.Reducer.mean().combine({
    reducer2: ee.Reducer.stdDev(),
    sharedInputs: true
  }),
  geometry: sp.geometry(),
  scale: 5000,
  maxPixels: 1e9
});

var statsMSI = meanAnnualMSI.reduceRegion({
  reducer: ee.Reducer.mean().combine({
    reducer2: ee.Reducer.stdDev(),
    sharedInputs: true
  }),
  geometry: sp.geometry(),
  scale: 500,
  maxPixels: 1e9
});

print('Estatísticas dos Rasters Anuais Médios (2014-2024):');
print('Precipitação Média Anual (mm):', statsPrecip);
print('Evapotranspiração Média Anual (mm):', statsEvap);
print('Balanço Hídrico Médio Anual (mm):', statsWB);
print('MSI Médio Anual:', statsMSI);


/////////
// Exportação dos rasters
/////////

Export.image.toDrive({
  image: meanAnnualPrecip,
  description: 'precipitacao_media_anual_2014_2024',
  folder: 'GEE_Exports',
  scale: 5000,
  region: sp.geometry(),
  maxPixels: 1e9
});

Export.image.toDrive({
  image: meanAnnualEvap,
  description: 'evapotranspiracao_media_anual_2014_2024',
  folder: 'GEE_Exports',
  scale: 500,
  region: sp.geometry(),
  maxPixels: 1e9
});

Export.image.toDrive({
  image: meanAnnualWaterBalance,
  description: 'balanco_hidrico_medio_anual_2014_2024',
  folder: 'GEE_Exports',
  scale: 5000,
  region: sp.geometry(),
  maxPixels: 1e9
});

Export.image.toDrive({
  image: meanAnnualMSI,
  description: 'msi_medio_anual_2014_2024',
  folder: 'GEE_Exports',
  scale: 500,
  region: sp.geometry(),
  maxPixels: 1e9
});
