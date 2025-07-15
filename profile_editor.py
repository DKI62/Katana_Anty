import json
import os

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QLabel, QLineEdit, QPushButton, QMessageBox,
)

PROFILES_DIR = "profiles"
DEFAULT_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
              "AppleWebKit/537.36 (KHTML, like Gecko) "
              "Chrome/138.0.0.0 Safari/537.36")


class ProfileEditor(QDialog):
    def __init__(self, profile_name=None, profile_path=None):
        super().__init__()
        self.profile_name = profile_name or "Profile_1"
        self.profile_path = profile_path
        self.setWindowTitle("Katana Профиль")
        self.setGeometry(400, 200, 400, 320)
        self.layout = QVBoxLayout()

        self.layout.addWidget(QLabel("Название профиля:"))
        self.input_name = QLineEdit(self.profile_name)
        if self.profile_path:
            self.input_name.setReadOnly(True)
        self.layout.addWidget(self.input_name)

        self.layout.addWidget(QLabel("User-Agent:"))
        self.input_ua = QLineEdit(DEFAULT_UA)
        self.layout.addWidget(self.input_ua)

        self.layout.addWidget(QLabel("Прокси (пример socks5://ip:port):"))
        self.input_proxy = QLineEdit("")
        self.layout.addWidget(self.input_proxy)

        self.btn_save = QPushButton("Сохранить")
        self.btn_save.clicked.connect(self.save_profile)
        self.layout.addWidget(self.btn_save)

        self.setLayout(self.layout)
        if self.profile_path:
            self.load_profile()

    def load_profile(self):
        try:
            with open(self.profile_path, "r", encoding="utf-8") as f:
                profile = json.load(f)
            self.input_ua.setText(profile.get("user_agent", DEFAULT_UA))
            self.input_proxy.setText(profile.get("proxy", ""))
        except Exception as e:
            QMessageBox.critical(self, "Ошибка", f"Ошибка загрузки профиля: {e}")

    def save_profile(self):
        name = self.input_name.text().strip()
        if not name:
            QMessageBox.warning(self, "Ошибка", "Введите название профиля!")
            return

        profile = {
            "name": name,
            "user_agent": self.input_ua.text().strip(),
            "proxy": self.input_proxy.text().strip(),
        }

        os.makedirs(PROFILES_DIR, exist_ok=True)
        path = os.path.join(PROFILES_DIR, f"{name}.json")
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(profile, f, ensure_ascii=False, indent=2)
            QMessageBox.information(self, "Сохранено", f"Профиль {name} успешно сохранён!")
            self.accept()
        except Exception as e:
            QMessageBox.critical(self, "Ошибка", f"Не удалось сохранить профиль: {e}")
