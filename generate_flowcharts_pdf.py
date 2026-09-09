from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import landscape, A4
from reportlab.pdfgen import canvas


OUT = Path("output/pdf/eta_predictor_technical_flowcharts.pdf")
PAGE_W, PAGE_H = landscape(A4)

NAVY = HexColor("#102A43")
INK = HexColor("#243B53")
MUTED = HexColor("#627D98")
LINE = HexColor("#9FB3C8")
BLUE = HexColor("#D9EAF7")
BLUE_STROKE = HexColor("#1976B9")
TEAL = HexColor("#D7F4EF")
TEAL_STROKE = HexColor("#138A7E")
AMBER = HexColor("#FFF0C2")
AMBER_STROKE = HexColor("#C98A00")
PURPLE = HexColor("#E9E0FA")
PURPLE_STROKE = HexColor("#7546C8")
GREEN = HexColor("#DDF4E7")
GREEN_STROKE = HexColor("#218C5A")
RED = HexColor("#FCE1E1")
RED_STROKE = HexColor("#C0392B")


def text_center(c, lines, x, y, size=8.4, color=INK, leading=10):
    c.setFillColor(color)
    c.setFont("Helvetica", size)
    start = y + (len(lines) - 1) * leading / 2
    for i, line in enumerate(lines):
        c.drawCentredString(x, start - i * leading, line)


def rounded_node(c, x, y, w, h, lines, fill, stroke, radius=8, size=8.4):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(1.25)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)
    text_center(c, lines, x + w / 2, y + h / 2 - 3, size)


def terminal(c, x, y, w, h, lines):
    c.setFillColor(NAVY)
    c.setStrokeColor(NAVY)
    c.roundRect(x, y, w, h, h / 2, fill=1, stroke=1)
    text_center(c, lines, x + w / 2, y + h / 2 - 3, 8.5, white)


def diamond(c, cx, cy, w, h, lines):
    p = c.beginPath()
    p.moveTo(cx, cy + h / 2)
    p.lineTo(cx + w / 2, cy)
    p.lineTo(cx, cy - h / 2)
    p.lineTo(cx - w / 2, cy)
    p.close()
    c.setFillColor(AMBER)
    c.setStrokeColor(AMBER_STROKE)
    c.setLineWidth(1.25)
    c.drawPath(p, fill=1, stroke=1)
    text_center(c, lines, cx, cy - 3, 7.8)


def arrow(c, x1, y1, x2, y2, label=None):
    c.setStrokeColor(MUTED)
    c.setFillColor(MUTED)
    c.setLineWidth(1.1)
    c.line(x1, y1, x2, y2)
    import math
    angle = math.atan2(y2-y1, x2-x1)
    length = 6
    for d in (2.6, -2.6):
        c.line(x2, y2, x2 - length*math.cos(angle+d), y2 - length*math.sin(angle+d))
    if label:
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString((x1+x2)/2, (y1+y2)/2+4, label)


def header(c, number, title, subtitle):
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H - 67, PAGE_W, 67, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(42, PAGE_H - 35, title)
    c.setFont("Helvetica", 8.5)
    c.drawString(43, PAGE_H - 51, subtitle)
    c.setFillColor(HexColor("#38BDF8"))
    c.roundRect(PAGE_W - 128, PAGE_H - 43, 88, 22, 11, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(PAGE_W - 84, PAGE_H - 35, f"FLOW {number} OF 3")
    c.setStrokeColor(HexColor("#37B3D9"))
    c.setLineWidth(1)
    c.line(42, PAGE_H - 87, PAGE_W - 42, PAGE_H - 87)


def footer(c, number):
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.5)
    c.drawString(42, 25, "Transit ETA and Delay Prediction System - Technical Architecture")
    c.drawRightString(PAGE_W - 42, 25, f"Page {number}")


def page_prediction(c):
    header(c, 1, "Execution Flow Chart", "Single ETA prediction request from dashboard to operational result")
    x, w, h = 271, 300, 34
    terminal(c, x+52, 468, w-104, 28, ["START: Dashboard prediction request"])
    rounded_node(c, x, 409, w, h, ["Collect inputs: distance, speed, congestion, weather, halt state"], BLUE, BLUE_STROKE)
    rounded_node(c, x, 350, w, h, ["POST /api/predict - Flask parses and validates request values"], TEAL, TEAL_STROKE)
    rounded_node(c, x, 291, w, h, ["ETAPredictorEngine.predict_one creates feature vector"], PURPLE, PURPLE_STROKE)
    rounded_node(c, x, 232, w, h, ["Each Random Forest tree traverses thresholds and returns an ETA vote"], BLUE, BLUE_STROKE, size=7.8)
    diamond(c, 421, 177, 150, 54, ["Aggregate votes", "and calculate spread"])
    rounded_node(c, x, 108, w, h, ["Mean ETA, 95% interval, confidence, theoretical time and delay"], GREEN, GREEN_STROKE, size=7.7)
    rounded_node(c, x, 49, w, h, ["Format duration and estimated arrival clock; return JSON response"], TEAL, TEAL_STROKE, size=7.8)
    terminal(c, x+34, 3, w-68, 28, ["END: Dashboard shows ETA, delay and vote distribution"])
    for top, bottom in [(468,443),(409,384),(350,325),(291,266),(232,204),(150,142),(108,83),(49,31)]:
        arrow(c, 421, top, 421, bottom)
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(52, 183, "Prediction outputs")
    c.setFont("Helvetica", 8)
    outputs = ["Predicted remaining minutes", "Formatted ETA and arrival clock", "95% confidence interval", "Delay versus free-flow travel time"]
    for i, item in enumerate(outputs):
        c.setFillColor(BLUE_STROKE)
        c.circle(58, 164 - i*18, 2.5, fill=1, stroke=0)
        c.setFillColor(INK)
        c.drawString(68, 161 - i*18, item)
    footer(c, 1)


def page_model(c):
    header(c, 2, "Random Forest Prediction Engine", "Model loading, tree traversal and confidence calculation")
    terminal(c, 54, 447, 220, 28, ["START: Flask application initializes"])
    rounded_node(c, 54, 384, 220, 36, ["Load eta_predictor_model.pkl", "with a NumPy-compatible unpickler"], BLUE, BLUE_STROKE)
    rounded_node(c, 54, 314, 220, 42, ["Extract estimator count, feature names", "tree depth and impurity-based importance"], TEAL, TEAL_STROKE)
    terminal(c, 54, 249, 220, 28, ["Engine ready for prediction requests"])
    arrow(c, 164, 447, 164, 420)
    arrow(c, 164, 384, 164, 356)
    arrow(c, 164, 314, 164, 277)

    rounded_node(c, 355, 447, 220, 32, ["Build five-value feature vector"], PURPLE, PURPLE_STROKE)
    rounded_node(c, 355, 382, 220, 38, ["remaining km - speed - congestion", "weather encoding - halted state"], BLUE, BLUE_STROKE)
    diamond(c, 465, 307, 142, 50, ["For each", "decision tree"])
    rounded_node(c, 355, 225, 220, 42, ["Follow feature thresholds until leaf", "and collect one tree ETA vote"], TEAL, TEAL_STROKE)
    arrow(c, 465, 447, 465, 420)
    arrow(c, 465, 382, 465, 332)
    arrow(c, 465, 282, 465, 267)
    arrow(c, 575, 246, 624, 246, "next tree")
    arrow(c, 624, 246, 624, 307)
    arrow(c, 624, 307, 536, 307)

    rounded_node(c, 644, 420, 150, 38, ["Mean, median, min", "max and standard deviation"], GREEN, GREEN_STROKE, size=7.5)
    rounded_node(c, 644, 339, 150, 44, ["95% interval", "mean +/- 1.96 x std dev"], AMBER, AMBER_STROKE, size=7.5)
    rounded_node(c, 644, 247, 150, 55, ["Confidence score from", "coefficient of variation", "bounded to 60-99%"], PURPLE, PURPLE_STROKE, size=7.2)
    terminal(c, 644, 157, 150, 30, ["Return prediction payload"])
    arrow(c, 465, 225, 644, 439)
    arrow(c, 719, 420, 719, 383)
    arrow(c, 719, 339, 719, 302)
    arrow(c, 719, 247, 719, 187)
    footer(c, 2)


def page_batch(c):
    header(c, 3, "Batch Prediction and Validation Flow", "CSV or JSON rows are predicted and evaluated when ground truth is available")
    terminal(c, 311, 470, 220, 28, ["START: POST /api/predict-batch"])
    diamond(c, 421, 411, 150, 52, ["Input", "source?"])
    rounded_node(c, 91, 335, 240, 42, ["CSV upload: decode file, read DictReader", "and trim column names and values"], BLUE, BLUE_STROKE, size=7.8)
    rounded_node(c, 511, 335, 240, 42, ["JSON payload: read rows array", "from request body"], BLUE, BLUE_STROKE)
    rounded_node(c, 311, 253, 220, 42, ["Validate rows and convert input features", "to float or integer values"], TEAL, TEAL_STROKE)
    diamond(c, 421, 177, 150, 54, ["Target remaining", "minutes supplied?"])
    rounded_node(c, 92, 82, 240, 44, ["Predict each row; attach ETA, formatted", "duration and confidence score"], PURPLE, PURPLE_STROKE, size=7.7)
    rounded_node(c, 510, 82, 240, 44, ["Calculate row error and aggregate", "MAE, RMSE and R-squared metrics"], GREEN, GREEN_STROKE, size=7.7)
    terminal(c, 312, 4, 218, 29, ["END: Return predictions, metrics and total count"])
    arrow(c, 421, 470, 421, 437)
    arrow(c, 361, 396, 211, 377, "CSV")
    arrow(c, 481, 396, 631, 377, "JSON")
    arrow(c, 211, 335, 421, 295)
    arrow(c, 631, 335, 421, 295)
    arrow(c, 421, 253, 421, 204)
    arrow(c, 359, 160, 212, 126, "No")
    arrow(c, 483, 160, 630, 126, "Yes")
    arrow(c, 212, 82, 390, 33)
    arrow(c, 630, 82, 452, 33)
    footer(c, 3)


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=landscape(A4), pageCompression=1)
    c.setTitle("ETA Predictor Technical Flow Charts")
    c.setAuthor("ETA Predictor")
    page_prediction(c)
    c.showPage()
    page_model(c)
    c.showPage()
    page_batch(c)
    c.save()


if __name__ == "__main__":
    build()
