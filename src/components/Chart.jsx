import React from 'react';
import { Bar } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels // Register the datalabels plugin
);

const BarChart = ({ chartData }) => {
  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      datalabels: {
        anchor: 'end',
        align: 'end',
        color: '#fff',
        font: {
          weight: 'bold',
        },
        formatter: (value) => `₹${value}`,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#fff',
        },
      },
      x: {
        ticks: {
          color: '#fff',
        },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
};

export default BarChart;
