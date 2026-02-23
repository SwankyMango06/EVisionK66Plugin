import QtQuick 2.15
import QtQuick.Controls 2.15

Item {
    anchors.fill: parent
    Column {
        anchors.fill: parent
        spacing: 10
        padding: 12

        Text {
            text: "Womier K66 Bridge (Localhost)"
            font.pixelSize: 16
        }

        Text {
            text: "Ensure your custom K66 controller app is running."
            wrapMode: Text.WordWrap
        }

        Text {
            text: service.controllers.length > 0 ? "Controller detected ✅" : "Searching for controller..."
        }
    }
}
