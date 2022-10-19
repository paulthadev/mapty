"use strict";

class Workout {
  date = new Date();
  id = (Date.now() + "").slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; //[lat,lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}, ${this.date.getFullYear()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = "running";
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = "cycling";

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

///////////////////////////////////////////////////
// APPLICATION ARCHITECTURE
const sidebar = document.querySelector(".sidebar");
const form = document.querySelector(".form");
const containerWorkouts = document.querySelector(".workouts");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputCadence = document.querySelector(".form__input--cadence");
const inputElevation = document.querySelector(".form__input--elevation");
const resetAll = document.querySelector(".reset__all");

const copyDate = document.querySelector(".copyright-year");

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workout = [];
  constructor() {
    // get users position
    this.#getPosition();

    // get data from local storage
    this.#getLocalStorage();

    // Attach event listeners
    // new workout form
    form.addEventListener("submit", this.#newWorkout.bind(this));

    // submit edited workout form
    form.addEventListener("submit", this.#submitWorkout.bind(this));

    // toggle elevation and cadence on the form type
    inputType.addEventListener("change", this.#toggleElevationField);

    // move to popup
    containerWorkouts.addEventListener("click", this.#moveToPopup.bind(this));

    // delete element icon
    containerWorkouts.addEventListener("click", this.#deleteWorkout.bind(this));

    // edit element icon
    containerWorkouts.addEventListener("click", this.#editWorkouts.bind(this));

    // reset all workout icon
    sidebar.addEventListener("click", this.#resetAll.bind(this));

    // copyright date
    copyDate.textContent = new Date().getUTCFullYear();
  }

  #getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this.#loadMap.bind(this),
        function () {
          alert("Could not get your position");
        }
      );
    }
  }

  #loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    // leaflet API
    this.#map = L.map("map").setView(coords, this.#mapZoomLevel);

    L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on("click", this.#showForm.bind(this));

    this.#workout.forEach((work) => {
      this.#renderWorkoutMarker(work);
    });
  }

  #showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove("hidden");
    inputDistance.focus();
  }

  #hideForm() {
    // empty input fields
    inputDistance.value =
      inputDuration.value =
      inputElevation.value =
      inputCadence.value =
        "";

    form.style.display = "none";
    form.classList.add("hidden");

    setTimeout(() => (form.style.display = "grid"), 1000);
  }

  #toggleElevationField() {
    inputElevation.closest(".form__row").classList.toggle("form__row--hidden");
    inputCadence.closest(".form__row").classList.toggle("form__row--hidden");
  }

  #newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every((inp) => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every((inp) => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // if workout running, create running object
    if (type === "running") {
      const cadence = +inputCadence.value;

      // check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert("Kindly input a positive number");

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // if workout cycling, create cycling object
    if (type === "cycling") {
      const elevation = +inputElevation.value;
      // check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert("Kindly input a positive number");

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // add new object to workout array
    this.#workout.push(workout);

    // render workout on map as marker
    this.#renderWorkoutMarker(workout);

    // render workout on list
    this.#renderWorkout(workout);

    // Hide form + clear input fields
    this.#hideForm();

    // set local storage to all workouts
    this.#setLocalStorage();

    // show reset button
    resetAll.classList.remove("hidden");
  }

  #renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          autoPan: true,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${workout.description}`
      )
      .openPopup();
  }

  #renderWorkout(workout) {
    let html = `
    
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <h2 class="workout__title">${workout.description}
      <span class="workout-edit">
            <i title="delete" class="fa-solid fa-trash delete__icon" data-id="${
              workout.id
            }">
            </i>
          </span>

        <span class="workout-edit">
            <i title="edit" class="fa-solid fa-pen-to-square edit__icon" data-id = "${
              workout.id
            }">
            </i>
          </span>
          
      
      </h2>
      <div class="workout__details">
        <span class="workout__icon">${
          workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"
        }</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>
    `;

    if (workout.type === "running")
      html += `
  <div class="workout__details">
             <span class="workout__icon">⚡️</span>
             <span class="workout__value">${workout.pace.toFixed(1)}</span>
             <span class="workout__unit">min/km</span>
           </div>
           <div class="workout__details">
             <span class="workout__icon">🦶🏼</span>
             <span class="workout__value">${workout.cadence}</span>
             <span class="workout__unit">spm</span>
           </div>
         </li>
     `;

    if (workout.type === "cycling")
      html += `
      <div class="workout__details">
      <span class="workout__icon">⚡️</span>
      <span class="workout__value">${workout.speed.toFixed(1)}</span>
      <span class="workout__unit">km/h</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⛰</span>
      <span class="workout__value">${workout.elevationGain}</span>
      <span class="workout__unit">m</span>
    </div>
  </li> 
     `;

    form.insertAdjacentHTML("afterend", html);
    resetAll.classList.remove("hidden");
  }

  #deleteWorkout(e) {
    const deleteEl = e.target.closest(".delete__icon");
    if (!deleteEl) return;

    const deleteWorkouts = this.#workout.filter(function (list) {
      return list.id !== deleteEl.dataset.id;
    });

    localStorage.removeItem("workouts");
    this.#workout = deleteWorkouts;

    this.#setLocalStorage();
    this.#resetElement();
    this.#updateWorkouts(this.#workout);
  }

  #editWorkouts(e) {
    const editEl = e.target.closest(".edit__icon");
    if (!editEl) return;

    const workoutData = this.#workout.find(
      (work) => work.id === editEl.dataset.id
    );

    this.workoutId = workoutData.id;
    inputType.value = workoutData.type;
    inputDistance.value = workoutData.distance;
    inputDuration.value = workoutData.duration;

    if (workoutData.type === "running") {
      inputElevation.closest(".form__row").classList.add("form__row--hidden");

      inputCadence.closest(".form__row").classList.remove("form__row--hidden");

      inputCadence.value = workoutData.cadence;
    }

    if (workoutData.type === "cycling") {
      inputCadence.closest(".form__row").classList.add("form__row--hidden");

      inputElevation
        .closest(".form__row")
        .classList.remove("form__row--hidden");

      inputElevation.value = workoutData.elevationGain;
    }

    if (editEl) {
      this.#showForm();
    }

    inputType.setAttribute("disabled", "true");
  }

  #submitWorkout(e) {
    e.preventDefault();
    if (!this.workoutId) return;

    const validInputs = (...inputs) =>
      inputs.every((inp) => Number.isFinite(inp));

    const allPositive = (...inputs) => inputs.every((inp) => inp > 0);

    const id = this.workoutId;

    const editworkouts = this.#workout.find((work) => work.id === id);

    if (!inputDistance.value) return;

    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    if (editworkouts.type === "running") {
      const cadence = +inputCadence.value;

      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        return alert("Inputs have to be positive numbers");
      }

      editworkouts.distance = distance;
      editworkouts.duration = duration;
      editworkouts.cadence = cadence;

      function calcPace(duration, distance) {
        // min/km
        const pace = duration / distance;
        return pace;
      }
      editworkouts.pace = calcPace(duration, distance);
    }

    if (editworkouts.type === "cycling") {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        return alert("Inputs have to be positive numbers");
      }

      editworkouts.distance = distance;
      editworkouts.duration = duration;
      editworkouts.elevationGain = elevation;

      function calcSpeed(distance, duration) {
        // km/hr
        const speed = distance / (duration / 60);
        return speed;
      }

      editworkouts.speed = calcSpeed(distance, duration);
    }

    localStorage.removeItem("workouts");
    this.#setLocalStorage();
    this.#resetElement();
    this.#hideForm();
    this.#updateWorkouts(this.#workout);
    inputType.removeAttribute("disabled");
  }

  #moveToPopup(e) {
    const workoutEl = e.target.closest(".workout");
    if (!workoutEl) return;

    const workout = this.#workout.find(
      (work) => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using public interface
    // workout.click();
  }

  #setLocalStorage() {
    localStorage.setItem("workouts", JSON.stringify(this.#workout));
  }

  #getLocalStorage() {
    const data = JSON.parse(localStorage.getItem("workouts"));

    if (!data) return;

    this.#workout = data;

    this.#workout.forEach((work) => {
      this.#renderWorkout(work);
    });
  }

  #resetElement() {
    const restoredElement = document.querySelectorAll(".workout");
    const restoredPopup = document.querySelectorAll(".leaflet-popup");
    const restoredMarker = document.querySelectorAll(".leaflet-marker-icon");
    const restoredShadow = document.querySelectorAll(".leaflet-marker-shadow");
    const restoredBoundary = document.querySelectorAll(".boundary_line");

    restoredElement.forEach((element) => {
      element.remove();
    });
    restoredBoundary.forEach((element) => {
      element.remove();
    });
    restoredPopup.forEach((popup) => {
      popup.remove();
    });
    restoredMarker.forEach((marker) => {
      marker.remove();
    });
    restoredShadow.forEach((shadow) => {
      shadow.remove();
    });

    this.#checkEmpty();
  }

  //Repopulating Workouts
  #updateWorkouts(workout) {
    workout.forEach((workout) => {
      this.#renderWorkout(workout);
      this.#renderWorkoutMarker(workout);
    });
  }

  #resetAll(e) {
    const resetIcon = e.target.closest(".reset__all");
    if (!resetIcon) return;

    localStorage.removeItem("workouts");
    if (window.confirm("⛔ reset all workouts ⛔")) {
      location.reload();
    }
  }

  #checkEmpty() {
    if (this.#workout === []) {
      resetAll.classList.add("hidden");
    }
  }
}
const app = new App();
