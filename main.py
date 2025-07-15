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

        # Проверка прокси через 9proxy
        if profile.get('proxy'):
            proxy = profile['proxy']
            if not proxy.startswith(('http://', 'socks5://')):
                profile['proxy'] = f'socks5://{proxy}'  # Форсируем SOCKS5 для 9proxy

        # Сохраняем обновленный профиль
        with open(profile_path, 'w') as f:
            json.dump(profile, f, indent=2)

        # Запуск через Puppeteer
        cmd = [
            "node",
            os.path.join(os.path.dirname(__file__), "katana_puppeteer.cjs"),
            profile_name
        ]

        try:
            subprocess.Popen(cmd, creationflags=subprocess.CREATE_NO_WINDOW)
            QMessageBox.information(self, "Успех", "Профиль запущен!")
        except Exception as e:
            QMessageBox.critical(self, "Ошибка", f"Ошибка запуска: {str(e)}")


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = ProfileManager()
    window.show()
    sys.exit(app.exec())
