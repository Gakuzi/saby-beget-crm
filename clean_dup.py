"with open('app.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Оставляем первое определение функции generate_report и удаляем дубликат
new_lines = []
found_first = False

for line in lines:
    if 'def generate_report(client_id):' in line:
        if not found_first:
            found_first = True
            new_lines.append(line)
        else:
            # Пропускаем второе определение функции до if __name__ == '__main__':
            continue
    elif found_first and 'beget_status = \"Доступы Beget не настроены' in line:
        continue
    elif found_first and 'api_url = f\"https://api.beget.com' in line:
        continue
    elif found_first and 'return render_template_string(REPORT_TEMPLATE, client=client, logs=logs, beget_status=beget_status)' in line:
        continue
    else:
        new_lines.append(line)

with open('app.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('Cleaned successfully!')
"