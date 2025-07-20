import subprocess
import sys
import os
import json
from PyQt6.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QLabel, QPushButton,
    QListWidget, QHBoxLayout, QMessageBox
)
from profile_editor import ProfileEditor

PROFILES_DIR = "profiles"


class ProfileManager(QWidget):
    def __init__(self):
        super().__init__()
        self.setup_ui()
        self.load_profiles()

    def setup_ui(self):
        self.setWindowTitle("Katana Anty")
        self.setGeometry(300, 200, 600, 400)
        layout = QVBoxLayout()
        layout.addWidget(QLabel("<h2>Список профилей Katana</h2>"))
        self.profile_list = QListWidget()
        layout.addWidget(self.profile_list)
        btn_layout = QHBoxLayout()
        buttons = [
            ("Создать профиль", self.create_profile),
            ("Редактировать", self.edit_profile),
            ("Удалить", self.delete_profile),
            ("Запустить", self.launch_profile)
        ]
        for text, callback in buttons:
            btn = QPushButton(text)
            btn.clicked.connect(callback)
            btn_layout.addWidget(btn)
        layout.addLayout(btn_layout)
        self.setLayout(layout)

    def load_profiles(self):
        self.profile_list.clear()
        os.makedirs(PROFILES_DIR, exist_ok=True)
        for filename in os.listdir(PROFILES_DIR):
            if filename.endswith(".json"):
                self.profile_list.addItem(filename[:-5])

    def create_profile(self):
        editor = ProfileEditor()
        if editor.exec():
            self.load_profiles()

    def edit_profile(self):
        current = self.profile_list.currentItem()
        if not current:
            QMessageBox.warning(self, "Ошибка", "Сначала выберите профиль")
            return
        profile_path = os.path.join(PROFILES_DIR, f"{current.text()}.json")
        editor = ProfileEditor(profile_name=current.text(), profile_path=profile_path)
        if editor.exec():
            self.load_profiles()

    def delete_profile(self):
        current = self.profile_list.currentItem()
        if not current:
            QMessageBox.warning(self, "Ошибка", "Сначала выберите профиль")
            return
        name = current.text()
        confirm = QMessageBox.question(self, "Удаление", f"Удалить профиль {name}?",
                                       QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
        if confirm == QMessageBox.StandardButton.Yes:
            path = os.path.join(PROFILES_DIR, f"{name}.json")
            if os.path.exists(path):
                os.remove(path)
            self.load_profiles()

    def launch_profile(self):
        current = self.profile_list.currentItem()
        if not current:
            QMessageBox.warning(self, "Ошибка", "Сначала выберите профиль")
            return

        profile_name = current.text()
        profile_path = os.path.join(PROFILES_DIR, f"{profile_name}.json")

        try:
            with open(profile_path, 'r') as f:
                profile = json.load(f)
        except Exception as e:
            QMessageBox.critical(self, "Ошибка", f"Ошибка чтения профиля: {str(e)}")
            return

        # Сохраняем обновленный профиль
        with open(profile_path, 'w') as f:
            json.dump(profile, f, indent=2)

        if getattr(sys, 'frozen', False):
            base_dir = os.path.dirname(sys.executable)
        else:
            base_dir = os.path.dirname(os.path.abspath(__file__))

        exe_path = os.path.join(base_dir, "node.exe")
        script_path = os.path.join(base_dir, "katana_puppeteer.cjs")
        debug_file = os.path.join(base_dir, "debug_paths.log")
        proc_log_file = os.path.join(base_dir, "puppeteer_proc.log")

        with open(debug_file, "a", encoding="utf-8") as dbg:
            dbg.write(f"\n--- LAUNCH TRY ---\n")
            dbg.write(f"exe_path = {exe_path} | exists = {os.path.exists(exe_path)}\n")
            dbg.write(f"script_path = {script_path} | exists = {os.path.exists(script_path)}\n")
            dbg.write(f"cwd = {os.getcwd()}\n")
            dbg.write(f"profile_name = {profile_name}\n")
            dbg.write(f"cmd = {[exe_path, script_path, profile_name]}\n")

        cmd = [exe_path, script_path, profile_name]

        try:
            with open(proc_log_file, "w", encoding="utf-8") as logfile:
                # Теперь ошибки и stdout сохраняются!
                subprocess.Popen(
                    cmd,
                    stdout=logfile,
                    stderr=logfile,
                    cwd=base_dir,
                    creationflags=subprocess.CREATE_NO_WINDOW
                )
            QMessageBox.information(self, "Успех", "Профиль запущен!")
        except Exception as e:
            with open(debug_file, "a", encoding="utf-8") as dbg:
                dbg.write(f"LAUNCH ERROR: {str(e)}\n")
            QMessageBox.critical(self, "Ошибка", f"Ошибка запуска: {str(e)}")


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = ProfileManager()
    window.show()
    sys.exit(app.exec())
