var query = location.search.substring(1);
let url = new URL(window.location.href);
let params = url.searchParams;

let data = JSON.parse(decodeURIComponent(params.get("data")));
let feedback = atob(decodeURIComponent(params.get("feedback")).replace(/"/g, ''));


var labels = ['Documentative', 'Code Readability', 'Code Turnover', 'Code Functionality'];
//All data is encoded in the URL, so we re-parse to get the relevant info.

var ctx = document.getElementById('myChart').getContext('2d');
var myChart = new Chart(ctx, {
  type: 'radar',
  data: {
    labels: labels,
    datasets: [{
      label: 'Data',
      data: data,
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      borderColor: 'rgba(255, 99, 132, 1)',
      borderWidth: 2,
      pointBackgroundColor: 'rgba(255, 99, 132, 1)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgba(255, 99, 132, 1)'
    }]        
  },
  options: {
    scale: {
      ticks: {
        beginAtZero: true,
        max: 1
      }
    }
  }
});

var customText = document.getElementById('advice');
customText.textContent = feedback;
