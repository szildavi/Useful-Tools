/** Accepts files by drag and drop, by clicking, and by pasting. */

export class DropZone {
  #element;
  #fileInput;
  #onFilesChosen;

  constructor({ element, fileInput, onFilesChosen }) {
    this.#element = element;
    this.#fileInput = fileInput;
    this.#onFilesChosen = onFilesChosen;
    this.#connectClickEvents();
    this.#connectDragEvents();
  }

  /** Open the file picker, as if the drop zone had been clicked. */
  openFilePicker() {
    this.#fileInput.click();
  }

  #connectClickEvents() {
    this.#element.addEventListener('click', () => this.openFilePicker());
    this.#element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.openFilePicker();
      }
    });
    this.#fileInput.addEventListener('change', () => {
      this.#publishFiles([...this.#fileInput.files]);
      this.#fileInput.value = '';
    });
  }

  #connectDragEvents() {
    for (const eventName of ['dragenter', 'dragover']) {
      this.#element.addEventListener(eventName, (event) => {
        event.preventDefault();
        this.#element.classList.add('drop-zone--active');
      });
    }
    for (const eventName of ['dragleave', 'drop']) {
      this.#element.addEventListener(eventName, (event) => {
        event.preventDefault();
        this.#element.classList.remove('drop-zone--active');
      });
    }
    this.#element.addEventListener('drop', (event) => {
      this.#publishFiles([...event.dataTransfer.files]);
    });
  }

  #publishFiles(files) {
    if (files.length > 0) {
      this.#onFilesChosen(files);
    }
  }
}
