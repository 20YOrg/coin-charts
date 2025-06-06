# Coin Charts

A lightweight web application for displaying interactive candlestick charts, designed for financial and cryptocurrency data visualization, inspired by TradingView's charting library. Built with HTML5 Canvas and JavaScript, with inline CSS for simplicity and clear price/timeline labels.

## Features
- **Candlestick Charts**: Displays OHLC (Open, High, Low, Close) data with customizable candle width and colors.
- **Zooming**:
  - Time axis zoom via mouse wheel (anywhere except price axis).
  - Price axis zoom via mouse wheel over the price axis (right side).
- **Panning**: Drag to pan the time axis.
- **Price Scales**: Toggle between linear and logarithmic scales.
- **Time Axis**: Displays formatted dates aligned with candlesticks.
- **Compact Design**: Candle spacing is 1/4 of candle width for a tight, professional look.
- **Clear Labels**: Price and timeline labels are highly visible for easy reading.

## Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, etc.).
- Git installed on your system.
- A GitHub account for hosting.

### Installation
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/coin-charts.git
   cd coin-charts
   ```

2. **Open the App**:
   - Open `index.html` in a web browser to view the chart.
   - Alternatively, serve the files using a local server (e.g., with Python):
     ```bash
     python -m http.server 8000
     ```
     Then visit `http://localhost:8000` in your browser.

### Usage
- **Interact with the Chart**:
  - **Zoom Time**: Scroll the mouse wheel anywhere except the price axis to zoom in/out on the time axis.
  - **Zoom Price**: Scroll over the price axis (right side) to zoom in/out on the price scale.
  - **Pan**: Click and drag to move the chart left/right.
  - **Toggle Scale**: Use the dropdown in the top-right to switch between linear and logarithmic price scales.
- **Customize Data**: Edit the `sampleData` array in `index.html` or use the `chart.setData(newData)` method to load your own OHLC data in the format:
  ```json
  { time: 'YYYY-MM-DD', open: number, high: number, low: number, close: number }
  ```

## Deployment
Deploy the app using GitHub Pages for free hosting:

1. **Enable GitHub Pages**:
   - Go to your repository on GitHub: `https://github.com/your-username/coin-charts`.
   - Navigate to **Settings** > **Pages**.
   - Set the **Source** to the `main` branch and `/ (root)` folder.
   - Save, and GitHub will provide a URL (e.g., `https://your-username.github.io/coin-charts`).

2. **Push Updates**:
   - Any changes pushed to the `main` branch will automatically update the deployed site.

## Project Structure
```
coin-charts/
├── index.html        # Main web app page with chart and inline CSS
├── README.md         # This documentation
├── .gitignore        # Git ignore file
└── data/             # (Optional) Directory for sample data files
```

## Contributing
Contributions are welcome! To contribute:
1. Fork the repository.
2. Create a new branch (`git checkout -b feature/your-feature`).
3. Make your changes and commit (`git commit -m 'Add your feature'`).
4. Push to your branch (`git push origin feature/your-feature`).
5. Open a Pull Request on GitHub.

Please ensure your code follows the existing style and includes appropriate comments.

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details (add a `LICENSE` file to the repository if desired).

## Future Enhancements
- Add tooltips for candlestick data on hover.
- Support additional chart types (e.g., line, bar).
- Implement technical indicators (e.g., moving averages, RSI).
- Allow loading data from external sources (e.g., JSON files or cryptocurrency APIs).
- Add a data input form for custom OHLC data.

## Contact
For questions or suggestions, open an issue on GitHub or contact [your-email@example.com].