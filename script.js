// GLOBAL WEATHER APP - OPEN-METEO
// FIXED + COMPLETED VERSION

// ==========================================
// 1. HTML ELEMENTS & STATE
// ==========================================
const cityInput = document.getElementById("city");
const searchBtn = document.getElementById("searchBtn");
const locationBtn = document.getElementById("locationBtn");
const weatherEl = document.getElementById("weather");
const loading = document.getElementById("loading");
const errorEl = document.getElementById("error");
const cityName = document.getElementById("cityName");
const temp = document.getElementById("temp");
const celsiusBtn = document.getElementById("celsiusBtn");
const fahrenheitBtn = document.getElementById("fahrenheitBtn");
const condition = document.getElementById("condition");
const humidity = document.getElementById("humidity");
const wind = document.getElementById("wind");
const sunrise = document.getElementById("sunrise");
const sunset = document.getElementById("sunset");
const icon = document.getElementById("icon");
const feelsLike = document.getElementById("feelsLike");
const uvIndex = document.getElementById("uvIndex");
const rainChance = document.getElementById("rainChance");
const windDirection = document.getElementById("windDirection");
const forecastContainer = document.getElementById("forecastContainer");
const hourlyContainer = document.getElementById("hourlyContainer");

// Units & last data
let temperatureUnit = localStorage.getItem("temperatureUnit") || "C";
let windUnit = localStorage.getItem("windUnit") || "kmh";
let lastTemperatureCelsius = null;
let lastFeelsLikeCelsius = null;
let lastWindKmh = null;
let lastWeatherData = null;
let lastLocationName = "";
let lastLat = null;
let lastLon = null;

// Map
let weatherMap = null;
let mapMarker = null;

// Favorites
let favoriteCities = JSON.parse(localStorage.getItem("favoriteCities") || "[]");

// Recent searches
let recentSearches = JSON.parse(localStorage.getItem("recentSearches") || "[]");

// Notification settings
let notifSettings = JSON.parse(localStorage.getItem("notifSettings") || JSON.stringify({
   rain: true, heat: true, cold: true, wind: true, storm: true,
   heatThreshold: 40, coldThreshold: -10, windThreshold: 50
}));

// ==========================================
// 2. INIT EVENT LISTENERS
// ==========================================
searchBtn.addEventListener("click", getWeather);
locationBtn.addEventListener("click", getCurrentLocation);
cityInput.addEventListener("keydown", (e) => {
   if (e.key === "Enter") getWeather();
});

// Unit buttons (main + settings)
function setTempUnit(unit) {
   temperatureUnit = unit;
   localStorage.setItem("temperatureUnit", unit);
   document.querySelectorAll("#celsiusBtn, #settingsC").forEach(b => b.classList.toggle("active", unit === "C"));
   document.querySelectorAll("#fahrenheitBtn, #settingsF").forEach(b => b.classList.toggle("active", unit === "F"));
   updateAllTemperatureDisplays();
}
celsiusBtn.addEventListener("click", () => setTempUnit("C"));
fahrenheitBtn.addEventListener("click", () => setTempUnit("F"));
document.getElementById("settingsC")?.addEventListener("click", () => setTempUnit("C"));
document.getElementById("settingsF")?.addEventListener("click", () => setTempUnit("F"));

function setWindUnit(unit) {
   windUnit = unit;
   localStorage.setItem("windUnit", unit);
   document.getElementById("windKmh")?.classList.toggle("active", unit === "kmh");
   document.getElementById("windMph")?.classList.toggle("active", unit === "mph");
   updateAllWindDisplays();
}
document.getElementById("windKmh")?.addEventListener("click", () => setWindUnit("kmh"));
document.getElementById("windMph")?.addEventListener("click", () => setWindUnit("mph"));

// Apply saved units on load
setTempUnit(temperatureUnit);
setWindUnit(windUnit);

// Favorites
const favoriteCityInput = document.getElementById("favoriteCityInput");
const addFavoriteBtn = document.getElementById("addFavoriteBtn");
const favoriteSearchResults = document.getElementById("favoriteSearchResults");
const favoriteCitiesList = document.getElementById("favoriteCitiesList");

if (favoriteCityInput) {
   favoriteCityInput.addEventListener("input", debounce(searchFavoriteCity, 350));
   favoriteCityInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") searchFavoriteCity();
   });
}
if (addFavoriteBtn) {
   addFavoriteBtn.addEventListener("click", searchFavoriteCity);
}

// Recent history
document.getElementById("clearHistoryBtn")?.addEventListener("click", clearRecentSearches);

// Notifications
document.getElementById("enableNotifBtn")?.addEventListener("click", requestNotificationPermission);
["notifRain", "notifHeat", "notifCold", "notifWind", "notifStorm"].forEach(id => {
   document.getElementById(id)?.addEventListener("change", saveNotifSettings);
});
["heatThreshold", "coldThreshold", "windThreshold"].forEach(id => {
   document.getElementById(id)?.addEventListener("change", saveNotifSettings);
});
loadNotifSettingsUI();

// AI
document.getElementById("aiSendBtn")?.addEventListener("click", handleAIQuery);
document.getElementById("aiInput")?.addEventListener("keydown", (e) => {
   if (e.key === "Enter") handleAIQuery();
});

// PWA install
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
   e.preventDefault();
   deferredPrompt = e;
   const btn = document.getElementById("installBtn");
   if (btn) btn.style.display = "inline-block";
});
document.getElementById("installBtn")?.addEventListener("click", async () => {
   if (!deferredPrompt) return;
   deferredPrompt.prompt();
   await deferredPrompt.userChoice;
   deferredPrompt = null;
   document.getElementById("installBtn").style.display = "none";
});

// Service Worker
if ("serviceWorker" in navigator) {
   navigator.serviceWorker.register("sw.js").catch(() => {});
}

// Initial renders
renderFavoriteCities();
renderRecentSearches();

// ==========================================
// 3. UTILITY
// ==========================================
function debounce(fn, ms) {
   let t;
   return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
   };
}

function escapeHTML(str) {
   return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}

function toF(c) { return (c * 9 / 5) + 32; }
function toMph(kmh) { return kmh * 0.621371; }

function formatTemp(celsius) {
   if (celsius == null || isNaN(celsius)) return "--";
   if (temperatureUnit === "F") return `${Math.round(toF(celsius))}°F`;
   return `${Math.round(celsius)}°C`;
}

function formatWind(kmh) {
   if (kmh == null || isNaN(kmh)) return "--";
   if (windUnit === "mph") return `${Math.round(toMph(kmh))} mph`;
   return `${Math.round(kmh)} km/h`;
}

function startLoading() {
   loading.style.display = "block";
   weatherEl.style.display = "none";
   errorEl.style.display = "none";
}
function finishLoading() {
   loading.style.display = "none";
}
function showError(message) {
   errorEl.textContent = message;
   errorEl.style.display = "block";
   weatherEl.style.display = "none";
}

// ==========================================
// 4. SEARCH WEATHER BY CITY
// ==========================================
async function getWeather() {
   const city = cityInput.value.trim();
   if (!city) {
      showError("Please enter a city name.");
      return;
   }
   startLoading();
   try {
      const geoURL = "https://geocoding-api.open-meteo.com/v1/search"
         + "?name=" + encodeURIComponent(city)
         + "&count=1&language=en&format=json";
      const geoResponse = await fetch(geoURL);
      if (!geoResponse.ok) throw new Error("Location service is unavailable.");
      const geoData = await geoResponse.json();
      if (!geoData.results || geoData.results.length === 0) {
         throw new Error("City not found. Please check the city name.");
      }
      const location = geoData.results[0];
      const data = await getWeatherData(location.latitude, location.longitude);
      displayWeather(data, location.name, location.country || "");
      addToRecentSearches(location.name, location.country || "", location.latitude, location.longitude);
      finishLoading();
   } catch (err) {
      console.error("Search Error:", err);
      finishLoading();
      showError(err.message || "Unable to get weather.");
   }
}

// ==========================================
// 5. GET WEATHER DATA
// ==========================================
async function getWeatherData(latitude, longitude) {
   const url = "https://api.open-meteo.com/v1/forecast"
      + "?latitude=" + latitude
      + "&longitude=" + longitude
      + "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,is_day"
      + "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max"
      + "&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,precipitation_probability,wind_speed_10m"
      + "&forecast_days=7&timezone=auto";
   const response = await fetch(url);
   if (!response.ok) throw new Error("Weather service is unavailable.");
   return await response.json();
}

// ==========================================
// 6. GET WEATHER BY COORDINATES (for favorites & GPS)
// ==========================================
async function getWeatherByCoordinates(latitude, longitude, name, country = "") {
   startLoading();
   try {
      const data = await getWeatherData(latitude, longitude);
      displayWeather(data, name || "Location", country);
      finishLoading();
   } catch (err) {
      console.error("Coordinates Weather Error:", err);
      finishLoading();
      showError("Unable to get weather for this location.");
   }
}

// ==========================================
// 7. DISPLAY WEATHER
// ==========================================
function displayWeather(data, name, country) {
   const current = data.current;
   lastWeatherData = data;
   lastLocationName = country ? `${name}, ${country}` : name;
   lastLat = data.latitude;
   lastLon = data.longitude;

   setDynamicBackground(current.weather_code);
   loadAirQuality(data.latitude, data.longitude);
   checkWeatherAlerts(data);
   updateMap(data.latitude, data.longitude, lastLocationName);

   cityName.textContent = lastLocationName;

   lastTemperatureCelsius = current.temperature_2m;
   lastFeelsLikeCelsius = current.apparent_temperature;
   lastWindKmh = current.wind_speed_10m;

   updateAllTemperatureDisplays();
   updateAllWindDisplays();

   condition.textContent = getWeatherDescription(current.weather_code);
   humidity.textContent = `${current.relative_humidity_2m}%`;
   windDirection.textContent = getWindDirection(current.wind_direction_10m);
   sunrise.textContent = formatTime(data.daily.sunrise[0]);
   sunset.textContent = formatTime(data.daily.sunset[0]);
   uvIndex.textContent = data.daily.uv_index_max[0] ?? "--";
   rainChance.textContent = `${data.daily.precipitation_probability_max[0] ?? 0}%`;

   icon.src = getWeatherIcon(current.weather_code, current.is_day);
   icon.alt = getWeatherDescription(current.weather_code);

   displayForecast(data);
   displayHourlyWeather(data);
   drawTemperatureChart(data);

   weatherEl.style.display = "block";
}

function updateAllTemperatureDisplays() {
   if (lastTemperatureCelsius != null) {
      temp.textContent = formatTemp(lastTemperatureCelsius);
   }
   if (lastFeelsLikeCelsius != null) {
      feelsLike.textContent = formatTemp(lastFeelsLikeCelsius);
   }
   // Re-render lists that show temperatures if we have data
   if (lastWeatherData) {
      displayForecast(lastWeatherData);
      displayHourlyWeather(lastWeatherData);
      drawTemperatureChart(lastWeatherData);
      renderFavoriteCities(); // update temp labels
   }
}

function updateAllWindDisplays() {
   if (lastWindKmh != null) {
      wind.textContent = formatWind(lastWindKmh);
   }
   if (lastWeatherData) {
      displayHourlyWeather(lastWeatherData);
   }
}

// ==========================================
// 8. 7-DAY FORECAST
// ==========================================
function displayForecast(data) {
   if (!forecastContainer) return;
   forecastContainer.innerHTML = "";
   const dates = data.daily.time;
   const maxTemps = data.daily.temperature_2m_max;
   const minTemps = data.daily.temperature_2m_min;
   const codes = data.daily.weather_code;

   for (let i = 0; i < dates.length; i++) {
      const card = document.createElement("div");
      card.className = "forecast-card";
      const date = new Date(dates[i] + "T12:00:00");
      const dayName = i === 0 ? "Today" : date.toLocaleDateString("en-US", { weekday: "short" });
      card.innerHTML = `
         <h3>${dayName}</h3>
         <img src="${getWeatherIcon(codes[i], 1)}" alt="${getWeatherDescription(codes[i])}">
         <p class="max-temp">${formatTemp(maxTemps[i])}</p>
         <p class="min-temp">${formatTemp(minTemps[i])}</p>
         <p>${getWeatherDescription(codes[i])}</p>
      `;
      forecastContainer.appendChild(card);
   }
}

// ==========================================
// 9. HOURLY FORECAST (single clean version)
// ==========================================
function displayHourlyWeather(data) {
   if (!hourlyContainer) return;
   hourlyContainer.innerHTML = "";

   const times = data.hourly.time;
   const temperatures = data.hourly.temperature_2m;
   const codes = data.hourly.weather_code;
   const rain = data.hourly.precipitation_probability;
   const winds = data.hourly.wind_speed_10m;

   const currentTime = new Date(data.current.time).getTime();
   let startIndex = 0;
   for (let i = 0; i < times.length; i++) {
      if (new Date(times[i]).getTime() >= currentTime) {
         startIndex = i;
         break;
      }
   }

   for (let i = startIndex; i < startIndex + 24 && i < times.length; i++) {
      const date = new Date(times[i]);
      const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const card = document.createElement("div");
      card.className = "hourly-card";
      card.innerHTML = `
         <div class="hourly-time">${time}</div>
         <img class="hourly-icon" src="${getWeatherIcon(codes[i], 1)}" alt="">
         <div class="hourly-temp">${formatTemp(temperatures[i])}</div>
         <div class="hourly-rain">🌧️ ${rain[i] ?? 0}%</div>
         <div class="hourly-wind">💨 ${formatWind(winds[i])}</div>
      `;
      hourlyContainer.appendChild(card);
   }
}

// ==========================================
// 10. GPS / CURRENT LOCATION
// ==========================================
function getCurrentLocation() {
   if (!navigator.geolocation) {
      showError("Geolocation is not supported by your browser.");
      return;
   }
   startLoading();
   navigator.geolocation.getCurrentPosition(
      async (position) => {
         const latitude = position.coords.latitude;
         const longitude = position.coords.longitude;
         try {
            const data = await getWeatherData(latitude, longitude);
            let name = "Current Location";
            let country = "";
            try {
               // Approximate reverse via big cities search is limited; keep simple
               name = "Current Location";
            } catch (e) {}
            displayWeather(data, name, country);
            finishLoading();
         } catch (err) {
            console.error("GPS Weather Error:", err);
            finishLoading();
            showError("Unable to get weather for your location.");
         }
      },
      (geoError) => {
         finishLoading();
         if (geoError.code === geoError.PERMISSION_DENIED) {
            showError("Location permission was denied.");
         } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
            showError("Your location is unavailable.");
         } else if (geoError.code === geoError.TIMEOUT) {
            showError("Location request timed out.");
         } else {
            showError("Unable to get your location.");
         }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
   );
}

// ==========================================
// 11. WEATHER DESCRIPTION & ICON
// ==========================================
function getWeatherDescription(code) {
   const descriptions = {
      0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
      45: "Fog", 48: "Rime fog",
      51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
      56: "Light freezing drizzle", 57: "Dense freezing drizzle",
      61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
      66: "Light freezing rain", 67: "Heavy freezing rain",
      71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 77: "Snow grains",
      80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
      85: "Slight snow showers", 86: "Heavy snow showers",
      95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail"
   };
   return descriptions[code] || "Unknown weather";
}

function getWeatherIcon(code, isDay = 1) {
   let symbol = "☁️";
   if (code === 0) symbol = isDay ? "☀️" : "🌙";
   else if (code === 1 || code === 2) symbol = isDay ? "🌤️" : "☁️";
   else if (code === 3) symbol = "☁️";
   else if (code === 45 || code === 48) symbol = "🌫️";
   else if (code >= 51 && code <= 57) symbol = "🌦️";
   else if (code >= 61 && code <= 67) symbol = "🌧️";
   else if (code >= 71 && code <= 77) symbol = "❄️";
   else if (code >= 80 && code <= 82) symbol = "🌦️";
   else if (code >= 85 && code <= 86) symbol = "🌨️";
   else if (code >= 95) symbol = "⛈️";

   const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <text x="60" y="78" text-anchor="middle" font-size="70">${symbol}</text>
   </svg>`;
   return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function getWindDirection(degrees) {
   if (degrees == null) return "--";
   const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
   return directions[Math.round(degrees / 45) % 8];
}

function formatTime(value) {
   if (!value) return "--";
   return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ==========================================
// 12. DYNAMIC BACKGROUND
// ==========================================
function setDynamicBackground(code) {
   document.body.classList.remove("clear-weather", "cloudy-weather", "rain-weather", "storm-weather", "snow-weather", "fog-weather");
   if (code === 0) document.body.classList.add("clear-weather");
   else if (code === 1 || code === 2 || code === 3) document.body.classList.add("cloudy-weather");
   else if (code === 45 || code === 48) document.body.classList.add("fog-weather");
   else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) document.body.classList.add("rain-weather");
   else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) document.body.classList.add("snow-weather");
   else if (code >= 95) document.body.classList.add("storm-weather");
   else document.body.classList.add("cloudy-weather");
}

// ==========================================
// 13. AIR QUALITY
// ==========================================
async function loadAirQuality(latitude, longitude) {
   try {
      const params = new URLSearchParams({
         latitude, longitude,
         current: "us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide"
      });
      const url = "https://air-quality-api.open-meteo.com/v1/air-quality?" + params.toString();
      const response = await fetch(url);
      if (!response.ok) throw new Error("Air Quality API Error");
      const data = await response.json();
      const air = data.current;
      document.getElementById("aqiValue").textContent = air.us_aqi ?? "--";
      document.getElementById("aqiStatus").textContent = air.us_aqi != null ? getAQIStatus(air.us_aqi) : "Unavailable";
      document.getElementById("pm25").textContent = air.pm2_5 != null ? Math.round(air.pm2_5) : "--";
      document.getElementById("pm10").textContent = air.pm10 != null ? Math.round(air.pm10) : "--";
      document.getElementById("co").textContent = air.carbon_monoxide != null ? Math.round(air.carbon_monoxide) : "--";
      document.getElementById("no2").textContent = air.nitrogen_dioxide != null ? Math.round(air.nitrogen_dioxide) : "--";
   } catch (err) {
      console.error("Air Quality Error:", err);
      ["aqiValue", "pm25", "pm10", "co", "no2"].forEach(id => {
         const el = document.getElementById(id);
         if (el) el.textContent = "--";
      });
      const status = document.getElementById("aqiStatus");
      if (status) status.textContent = "Unavailable";
   }
}

function getAQIStatus(aqi) {
   if (aqi <= 50) return "Good";
   if (aqi <= 100) return "Moderate";
   if (aqi <= 150) return "Unhealthy for Sensitive Groups";
   if (aqi <= 200) return "Unhealthy";
   if (aqi <= 300) return "Very Unhealthy";
   return "Hazardous";
}

// ==========================================
// 14. WEATHER ALERTS (with user settings)
// ==========================================
function loadNotifSettingsUI() {
   const map = {
      notifRain: "rain", notifHeat: "heat", notifCold: "cold",
      notifWind: "wind", notifStorm: "storm"
   };
   Object.entries(map).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!notifSettings[key];
   });
   if (document.getElementById("heatThreshold")) document.getElementById("heatThreshold").value = notifSettings.heatThreshold;
   if (document.getElementById("coldThreshold")) document.getElementById("coldThreshold").value = notifSettings.coldThreshold;
   if (document.getElementById("windThreshold")) document.getElementById("windThreshold").value = notifSettings.windThreshold;
}

function saveNotifSettings() {
   notifSettings.rain = document.getElementById("notifRain")?.checked ?? true;
   notifSettings.heat = document.getElementById("notifHeat")?.checked ?? true;
   notifSettings.cold = document.getElementById("notifCold")?.checked ?? true;
   notifSettings.wind = document.getElementById("notifWind")?.checked ?? true;
   notifSettings.storm = document.getElementById("notifStorm")?.checked ?? true;
   notifSettings.heatThreshold = Number(document.getElementById("heatThreshold")?.value) || 40;
   notifSettings.coldThreshold = Number(document.getElementById("coldThreshold")?.value) || -10;
   notifSettings.windThreshold = Number(document.getElementById("windThreshold")?.value) || 50;
   localStorage.setItem("notifSettings", JSON.stringify(notifSettings));
   if (lastWeatherData) checkWeatherAlerts(lastWeatherData);
}

function requestNotificationPermission() {
   if (!("Notification" in window)) {
      document.getElementById("notifPermissionStatus").textContent = "Browser does not support notifications.";
      return;
   }
   Notification.requestPermission().then(perm => {
      const status = document.getElementById("notifPermissionStatus");
      if (perm === "granted") status.textContent = "Notifications enabled.";
      else if (perm === "denied") status.textContent = "Permission denied. Enable it in browser settings.";
      else status.textContent = "Permission not granted yet.";
   });
}

function checkWeatherAlerts(data) {
   const container = document.getElementById("alertsContainer");
   if (!container) return;
   container.innerHTML = "";

   const current = data.current;
   const code = current.weather_code;
   const temperature = current.temperature_2m;
   const windSpeed = current.wind_speed_10m;
   const alerts = [];

   if (notifSettings.storm && code >= 95) {
      alerts.push({ title: "Thunderstorm Warning", message: "Thunderstorm conditions detected. Stay indoors and avoid exposed areas.", severity: "EXTREME" });
   }
   if (notifSettings.rain && ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))) {
      alerts.push({ title: "Heavy Rain Warning", message: "Rain is affecting the area. Take care while travelling.", severity: "MEDIUM" });
   }
   if (notifSettings.rain && (code >= 51 && code <= 57)) {
      alerts.push({ title: "Drizzle / Light Rain", message: "Light rain or drizzle expected.", severity: "MEDIUM" });
   }
   if (notifSettings.heat && temperature >= notifSettings.heatThreshold) {
      alerts.push({ title: "Extreme Heat Warning", message: `Temperature is ${Math.round(temperature)}°C. Stay hydrated and avoid prolonged sun exposure.`, severity: "EXTREME" });
   }
   if (notifSettings.cold && temperature <= notifSettings.coldThreshold) {
      alerts.push({ title: "Extreme Cold Warning", message: `Temperature is ${Math.round(temperature)}°C. Protect yourself from cold.`, severity: "EXTREME" });
   }
   if (notifSettings.wind && windSpeed >= notifSettings.windThreshold) {
      alerts.push({ title: "Strong Wind Warning", message: `Wind speed ${Math.round(windSpeed)} km/h. Use caution outdoors.`, severity: "HIGH" });
   }

   if (alerts.length === 0) {
      container.innerHTML = `<div class="no-alert">No significant weather alerts</div>`;
      return;
   }

   alerts.forEach(alert => {
      const cls = alert.severity.toLowerCase();
      container.innerHTML += `
         <div class="weather-alert ${cls}">
            <span class="alert-severity">${alert.severity}</span>
            <h3>${alert.title}</h3>
            <p>${alert.message}</p>
         </div>`;
   });

   // Browser notification (once per session for same type)
   if (Notification.permission === "granted" && alerts.length > 0) {
      const key = "lastNotified_" + alerts[0].title;
      if (!sessionStorage.getItem(key)) {
         new Notification(alerts[0].title, { body: alerts[0].message, icon: "/icon-192.png" });
         sessionStorage.setItem(key, "1");
      }
   }
}

// ==========================================
// 15. 7-DAY TEMPERATURE CHART
// ==========================================
function drawTemperatureChart(data) {
   const canvas = document.getElementById("temperatureChart");
   if (!canvas || !data?.daily) return;
   const ctx = canvas.getContext("2d");
   if (!ctx) return;

   const dates = data.daily.time || [];
   const maxTemps = data.daily.temperature_2m_max || [];
   const minTemps = data.daily.temperature_2m_min || [];
   const daysCount = Math.min(7, dates.length, maxTemps.length, minTemps.length);
   const chartDates = dates.slice(0, daysCount);
   const chartMax = maxTemps.slice(0, daysCount);
   const chartMin = minTemps.slice(0, daysCount);

   const rect = canvas.getBoundingClientRect();
   const width = Math.max(rect.width, 300);
   const height = 400;
   const dpr = window.devicePixelRatio || 1;
   canvas.style.width = "100%";
   canvas.style.height = height + "px";
   canvas.width = width * dpr;
   canvas.height = height * dpr;
   ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
   ctx.clearRect(0, 0, width, height);

   const paddingLeft = 55, paddingRight = 25, paddingTop = 40, paddingBottom = 90;
   const chartWidth = width - paddingLeft - paddingRight;
   const chartHeight = height - paddingTop - paddingBottom;

   const allTemps = [...chartMax, ...chartMin].filter(v => typeof v === "number" && Number.isFinite(v));
   if (allTemps.length === 0) return;

   let minTemp = Math.floor(Math.min(...allTemps) - 3);
   let maxTemp = Math.ceil(Math.max(...allTemps) + 3);
   if (minTemp === maxTemp) { minTemp -= 2; maxTemp += 2; }

   function getX(i) {
      if (chartDates.length === 1) return paddingLeft + chartWidth / 2;
      return paddingLeft + (i / (chartDates.length - 1)) * chartWidth;
   }
   function getY(t) {
      return paddingTop + ((maxTemp - t) / (maxTemp - minTemp)) * chartHeight;
   }

   // Grid
   ctx.font = "12px Arial";
   ctx.textAlign = "right";
   for (let i = 0; i <= 5; i++) {
      const value = minTemp + ((maxTemp - minTemp) / 5) * i;
      const y = getY(value);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.stroke();
      const label = temperatureUnit === "F" ? Math.round(toF(value)) + "°" : Math.round(value) + "°";
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillText(label, paddingLeft - 8, y + 4);
   }

   function drawLine(temps, color, offset) {
      const points = [];
      temps.forEach((t, i) => {
         if (typeof t === "number" && Number.isFinite(t)) points.push({ i, t });
      });
      if (!points.length) return;
      ctx.beginPath();
      points.forEach((p, idx) => {
         const x = getX(p.i), y = getY(p.t);
         if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
      points.forEach(p => {
         const x = getX(p.i), y = getY(p.t);
         ctx.beginPath();
         ctx.arc(x, y, 5, 0, Math.PI * 2);
         ctx.fillStyle = color;
         ctx.fill();
         ctx.beginPath();
         ctx.arc(x, y, 2, 0, Math.PI * 2);
         ctx.fillStyle = "#fff";
         ctx.fill();
         ctx.font = "bold 12px Arial";
         ctx.textAlign = "center";
         ctx.fillStyle = "#fff";
         ctx.fillText(formatTemp(p.t).replace("°C", "°").replace("°F", "°"), x, y + offset);
      });
   }

   drawLine(chartMax, "#22d3ee", -16);
   drawLine(chartMin, "rgba(255,255,255,0.7)", 20);

   const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
   chartDates.forEach((ds, i) => {
      const d = new Date(ds + "T00:00:00");
      const x = getX(i);
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText(weekDays[d.getDay()], x, height - 45);
      ctx.font = "11px Arial";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText(ds.slice(5), x, height - 28);
   });
}

// ==========================================
// 16. FAVORITE CITIES (FIXED)
// ==========================================
function saveFavoriteCities() {
   localStorage.setItem("favoriteCities", JSON.stringify(favoriteCities));
}

async function searchFavoriteCity() {
   const city = favoriteCityInput.value.trim();
   if (!city) {
      favoriteSearchResults.classList.remove("show");
      favoriteSearchResults.innerHTML = "";
      return;
   }
   try {
      // FIXED URL with proper & separators
      const url = "https://geocoding-api.open-meteo.com/v1/search"
         + "?name=" + encodeURIComponent(city)
         + "&count=5&language=en&format=json";
      const response = await fetch(url);
      if (!response.ok) throw new Error("City search failed.");
      const data = await response.json();
      favoriteSearchResults.innerHTML = "";
      if (!data.results || data.results.length === 0) {
         favoriteSearchResults.innerHTML = `<div class="favorite-result-item">City not found</div>`;
         favoriteSearchResults.classList.add("show");
         return;
      }
      data.results.forEach(location => {
         const btn = document.createElement("button");
         btn.type = "button";
         btn.className = "favorite-result-item";
         const country = location.country || "";
         const admin = location.admin1 ? `, ${location.admin1}` : "";
         btn.innerHTML = `
            <span class="favorite-result-city">${escapeHTML(location.name)}</span>
            <span class="favorite-result-country">${escapeHTML(country + admin)}</span>
         `;
         btn.addEventListener("click", () => addFavoriteCity(location));
         favoriteSearchResults.appendChild(btn);
      });
      favoriteSearchResults.classList.add("show");
   } catch (err) {
      console.error("Favorite city search error:", err);
      favoriteSearchResults.innerHTML = `<div class="favorite-result-item">Search failed. Try again.</div>`;
      favoriteSearchResults.classList.add("show");
   }
}

function addFavoriteCity(location) {
   if (!location || !location.id || location.latitude == null || location.longitude == null) {
      console.error("Invalid location for favorite:", location);
      return;
   }
   if (favoriteCities.some(c => c.id === location.id)) {
      // Use styled message instead of alert when possible
      const existing = document.querySelector(".favorite-search-results");
      if (existing) {
         existing.innerHTML = `<div class="favorite-result-item">This city is already in your favorites.</div>`;
         existing.classList.add("show");
      }
      return;
   }
   favoriteCities.push({
      id: location.id,
      name: location.name,
      country: location.country || "",
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone || "auto"
   });
   saveFavoriteCities();
   favoriteCityInput.value = "";
   favoriteSearchResults.innerHTML = "";
   favoriteSearchResults.classList.remove("show");
   renderFavoriteCities();
}

function removeFavoriteCity(id) {
   favoriteCities = favoriteCities.filter(c => c.id !== id);
   saveFavoriteCities();
   renderFavoriteCities();
}

async function loadFavoriteWeather(city, card) {
   try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current=temperature_2m,weather_code&timezone=auto`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Weather request failed.");
      const data = await response.json();
      const tempEl = card.querySelector(".favorite-city-temp");
      const statusEl = card.querySelector(".favorite-city-status");
      if (tempEl) tempEl.textContent = formatTemp(data.current.temperature_2m);
      if (statusEl) statusEl.textContent = getWeatherDescription(data.current.weather_code);
   } catch (err) {
      const statusEl = card.querySelector(".favorite-city-status");
      if (statusEl) statusEl.textContent = "Weather unavailable";
   }
}

function renderFavoriteCities() {
   if (!favoriteCitiesList) return;
   favoriteCitiesList.innerHTML = "";
   if (favoriteCities.length === 0) {
      favoriteCitiesList.innerHTML = `
         <div class="favorite-city-card">
            <div class="favorite-city-status">No favorite cities yet.</div>
         </div>`;
      return;
   }
   favoriteCities.forEach(city => {
      const card = document.createElement("div");
      card.className = "favorite-city-card";
      card.innerHTML = `
         <div class="favorite-city-top">
            <div>
               <h3 class="favorite-city-name">${escapeHTML(city.name)}</h3>
               <div class="favorite-city-country">${escapeHTML(city.country)}</div>
            </div>
         </div>
         <div class="favorite-city-temp">--</div>
         <div class="favorite-city-status">Loading weather...</div>
         <div class="favorite-city-actions">
            <button type="button" class="view-favorite-btn">View</button>
            <button type="button" class="remove-favorite-btn">Remove</button>
         </div>
      `;
      favoriteCitiesList.appendChild(card);
      loadFavoriteWeather(city, card);
      card.querySelector(".remove-favorite-btn").addEventListener("click", () => removeFavoriteCity(city.id));
      card.querySelector(".view-favorite-btn").addEventListener("click", () => {
         getWeatherByCoordinates(city.latitude, city.longitude, city.name, city.country);
         window.scrollTo({ top: 0, behavior: "smooth" });
      });
   });
}

// ==========================================
// 17. RECENT SEARCHES
// ==========================================
function addToRecentSearches(name, country, lat, lon) {
   const entry = { name, country, latitude: lat, longitude: lon };
   recentSearches = recentSearches.filter(r => !(r.name === name && r.country === country));
   recentSearches.unshift(entry);
   if (recentSearches.length > 8) recentSearches = recentSearches.slice(0, 8);
   localStorage.setItem("recentSearches", JSON.stringify(recentSearches));
   renderRecentSearches();
}

function renderRecentSearches() {
   const list = document.getElementById("recentSearchesList");
   const section = document.getElementById("recentSearchesSection");
   if (!list) return;
   list.innerHTML = "";
   if (recentSearches.length === 0) {
      if (section) section.style.display = "none";
      return;
   }
   if (section) section.style.display = "block";
   recentSearches.forEach((r, idx) => {
      const chip = document.createElement("div");
      chip.className = "recent-chip";
      chip.innerHTML = `
         <span>${escapeHTML(r.name)}${r.country ? ", " + escapeHTML(r.country) : ""}</span>
         <button type="button" class="remove-recent" title="Remove">×</button>
      `;
      chip.querySelector("span").addEventListener("click", () => {
         getWeatherByCoordinates(r.latitude, r.longitude, r.name, r.country);
      });
      chip.querySelector(".remove-recent").addEventListener("click", (e) => {
         e.stopPropagation();
         recentSearches.splice(idx, 1);
         localStorage.setItem("recentSearches", JSON.stringify(recentSearches));
         renderRecentSearches();
      });
      list.appendChild(chip);
   });
}

function clearRecentSearches() {
   recentSearches = [];
   localStorage.setItem("recentSearches", "[]");
   renderRecentSearches();
}

// ==========================================
// 18. INTERACTIVE MAP (Leaflet - free)
// ==========================================
function updateMap(lat, lon, label) {
   const mapDiv = document.getElementById("weatherMap");
   const status = document.getElementById("mapStatus");
   if (!mapDiv || typeof L === "undefined") {
      if (status) status.textContent = "Map library not loaded.";
      return;
   }
   try {
      if (!weatherMap) {
         weatherMap = L.map("weatherMap").setView([lat, lon], 10);
         L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap",
            maxZoom: 18
         }).addTo(weatherMap);
      } else {
         weatherMap.setView([lat, lon], 10);
      }
      if (mapMarker) weatherMap.removeLayer(mapMarker);
      mapMarker = L.marker([lat, lon]).addTo(weatherMap);
      if (label) mapMarker.bindPopup(escapeHTML(label)).openPopup();
      if (status) status.textContent = label || "Location shown on map";
      setTimeout(() => weatherMap.invalidateSize(), 200);
   } catch (err) {
      console.error("Map error:", err);
      if (status) status.textContent = "Unable to display map.";
   }
}

// ==========================================
// 19. AI WEATHER ASSISTANT (rule-based on live data)
// ==========================================
function handleAIQuery() {
   const input = document.getElementById("aiInput");
   const chat = document.getElementById("aiChat");
   if (!input || !chat) return;
   const question = input.value.trim();
   if (!question) return;

   const userMsg = document.createElement("div");
   userMsg.className = "ai-message ai-user";
   userMsg.textContent = question;
   chat.appendChild(userMsg);
   input.value = "";

   const answer = generateAIAnswer(question.toLowerCase());
   const botMsg = document.createElement("div");
   botMsg.className = "ai-message ai-bot";
   botMsg.textContent = answer;
   chat.appendChild(botMsg);
   chat.scrollTop = chat.scrollHeight;
}

function generateAIAnswer(q) {
   if (!lastWeatherData) {
      return "Please search for a city first so I can use live weather data.";
   }
   const cur = lastWeatherData.current;
   const daily = lastWeatherData.daily;
   const tempC = cur.temperature_2m;
   const feels = cur.apparent_temperature;
   const windK = cur.wind_speed_10m;
   const humid = cur.relative_humidity_2m;
   const code = cur.weather_code;
   const desc = getWeatherDescription(code);
   const rainToday = daily.precipitation_probability_max[0] ?? 0;
   const uv = daily.uv_index_max[0];

   if (q.includes("rain") || q.includes("باران") || q.includes("بارش")) {
      return `Today the chance of precipitation is about ${rainToday}%. Current condition: ${desc}.`;
   }
   if (q.includes("temp") || q.includes("hot") || q.includes("cold") || q.includes("تودوخه") || q.includes("سړه")) {
      return `Current temperature in ${lastLocationName} is ${formatTemp(tempC)} (feels like ${formatTemp(feels)}).`;
   }
   if (q.includes("wind") || q.includes("باد")) {
      return `Wind speed is currently ${formatWind(windK)}, direction ${getWindDirection(cur.wind_direction_10m)}.`;
   }
   if (q.includes("humid") || q.includes("رطوبت")) {
      return `Humidity is ${humid}%.`;
   }
   if (q.includes("uv") || q.includes("sun")) {
      return `Today's maximum UV index is ${uv}. ${uv >= 8 ? "Very high – use protection." : uv >= 5 ? "Moderate – be careful." : "Low to moderate."}`;
   }
   if (q.includes("forecast") || q.includes("tomorrow") || q.includes("week") || q.includes("ورځ")) {
      let msg = `7-day outlook for ${lastLocationName}: `;
      for (let i = 0; i < Math.min(3, daily.time.length); i++) {
         const d = new Date(daily.time[i] + "T12:00:00");
         const day = i === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" });
         msg += `${day}: ${formatTemp(daily.temperature_2m_max[i])} / ${formatTemp(daily.temperature_2m_min[i])}, ${getWeatherDescription(daily.weather_code[i])}. `;
      }
      return msg;
   }
   if (q.includes("storm") || q.includes("thunder") || q.includes("تندر")) {
      if (code >= 95) return "Thunderstorm conditions are currently detected. Stay safe indoors.";
      return "No thunderstorm indicated in current data.";
   }
   if (q.includes("hello") || q.includes("hi") || q.includes("سلام")) {
      return `Hello! Current weather in ${lastLocationName}: ${formatTemp(tempC)}, ${desc}. Ask me about rain, wind, forecast, UV, etc.`;
   }
   // Default summary
   return `In ${lastLocationName} it is currently ${formatTemp(tempC)} and ${desc}. Humidity ${humid}%, wind ${formatWind(windK)}, rain chance today ~${rainToday}%. You can ask about temperature, rain, wind, UV, or the forecast.`;
}

// ==========================================
// END OF SCRIPT
// ==========================================
